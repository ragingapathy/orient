/* Bring in your own Google Maps data from a Google Takeout export. Files are read in this browser and never uploaded.
   Saved lists (CSV) and "Saved Places" (GeoJSON) become saved places. Timeline visits (optional) are added as dated visits,
   but only to places that are already on your map; everything else in a Timeline file is discarded unread. */
'use strict';
(function (root) {
  // ---- parsing (pure, tested in takeout-check.cjs) ----
  const MAX_FILE = 200 * 1024 * 1024;
  const num = v => { const n = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(n) ? n : null; };
  const okLL = (lat, lng) => lat !== null && lng !== null && Math.abs(lat) <= 85 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  function fromUrl(url) {
    const s = String(url || '');
    let m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(s) || /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s);
    if (m && okLL(+m[1], +m[2])) return [+m[2], +m[1]];
    m = /[?&](?:q|ll|query)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i.exec(s);
    return m && okLL(+m[1], +m[2]) ? [+m[2], +m[1]] : null;
  }
  function nameFromUrl(url) {
    const m = /\/maps\/place\/([^/@?]+)/.exec(String(url || '')); if (!m) return '';
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); } catch { return ''; }
  }
  function parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false;
    const s = String(text).replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
      else cell += c;
    }
    row.push(cell); if (row.some(x => x !== '')) rows.push(row);
    return rows;
  }
  const clip = (s, n) => String(s || '').trim().slice(0, n);
  function placesFromCsv(text, list) {
    const rows = parseCsv(text); if (rows.length < 2) return [];
    const head = rows[0].map(h => h.trim().toLowerCase()), col = (...names) => head.findIndex(h => names.includes(h));
    const iT = col('title', 'name'), iN = col('note', 'notes'), iU = col('url'), iC = col('comment', 'comments'), iA = col('address');
    if (iT < 0 && iU < 0) return [];
    const out = [];
    for (const r of rows.slice(1)) {
      const url = iU >= 0 ? r[iU] || '' : '';
      const name = clip((iT >= 0 && r[iT]) || nameFromUrl(url), 100); if (!name) continue;
      out.push({ name, address: clip(iA >= 0 ? r[iA] : '', 250), note: clip([iN >= 0 ? r[iN] : '', iC >= 0 ? r[iC] : ''].filter(Boolean).join(' · '), 800), url, coordinates: fromUrl(url), list });
    }
    return out;
  }
  function placesFromGeoJson(json, list) {
    const out = [];
    for (const f of (Array.isArray(json.features) ? json.features : [])) {
      const p = f.properties || {}, loc = p.Location || p.location || {}, gc = loc['Geo Coordinates'] || {};
      const url = p['Google Maps URL'] || p.google_maps_url || p.url || '';
      const g = f.geometry && f.geometry.coordinates;
      let coords = Array.isArray(g) && okLL(num(g[1]), num(g[0])) ? [num(g[0]), num(g[1])] : null;
      if (!coords && okLL(num(gc.Latitude), num(gc.Longitude))) coords = [num(gc.Longitude), num(gc.Latitude)];
      if (!coords) coords = fromUrl(url);
      const name = clip(p.Title || p.title || loc['Business Name'] || p.name || nameFromUrl(url), 100); if (!name) continue;
      out.push({ name, address: clip(loc.Address || loc.address || '', 250), note: clip(p.Comment || p.comment || p.Note || '', 800), url, coordinates: coords, list });
    }
    return out;
  }
  function latLng(s) { const m = /(-?\d+(?:\.\d+)?)\s*°?\s*,\s*(-?\d+(?:\.\d+)?)/.exec(String(s || '')); return m && okLL(+m[1], +m[2]) ? [+m[2], +m[1]] : null; }
  function visitsFromTimeline(json) {
    const out = [];
    const segs = Array.isArray(json) ? json : Array.isArray(json.semanticSegments) ? json.semanticSegments : null;
    if (segs) for (const s of segs) {
      const v = s && s.visit; if (!v) continue;
      const c = v.topCandidate || {}, at = latLng(c.placeLocation && (c.placeLocation.latLng || c.placeLocation)), day = String(s.startTime || '').slice(0, 10);
      if (at && /^\d{4}-\d{2}-\d{2}$/.test(day)) out.push({ day, coordinates: at });
    }
    if (Array.isArray(json.timelineObjects)) for (const o of json.timelineObjects) {
      const v = o && o.placeVisit, l = v && v.location, day = String(v && v.duration && v.duration.startTimestamp || '').slice(0, 10);
      if (l && /^\d{4}-\d{2}-\d{2}$/.test(day) && okLL(l.latitudeE7 / 1e7, l.longitudeE7 / 1e7)) out.push({ day, coordinates: [l.longitudeE7 / 1e7, l.latitudeE7 / 1e7] });
    }
    return out;
  }
  // What is this file? Returns {type:'places', list, items} | {type:'visits', items} | {type:'none', why}
  function readFile(name, text) {
    const base = String(name).replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
    if (/\.csv$/i.test(name)) { const items = placesFromCsv(text, base); return items.length ? { type: 'places', list: base, items } : { type: 'none', why: 'No places found in that list.' }; }
    let json; try { json = JSON.parse(text); } catch { return { type: 'none', why: 'That file isn’t readable JSON or CSV.' }; }
    if (json && json.type === 'FeatureCollection') {
      const items = placesFromGeoJson(json, /saved places/i.test(base) ? 'Saved places' : base);
      return items.length ? { type: 'places', list: items[0].list, items } : { type: 'none', why: 'No places found in that file.' };
    }
    if (Array.isArray(json) || (json && (json.semanticSegments || json.timelineObjects))) {
      const items = visitsFromTimeline(json); return items.length ? { type: 'visits', items } : { type: 'none', why: 'No place visits found. Orient only uses visits from Timeline, not raw location points.' };
    }
    return { type: 'none', why: 'I don’t recognise that file. Try the CSV lists from Saved, or Saved Places.json.' };
  }
  const guessKind = name => /library/i.test(name) ? 'Library' : /comic/i.test(name) ? 'Comic shop' : /\b(park|trail|garden|beach|metropark|preserve)\b/i.test(name) ? 'Public space'
    : /\b(caf[eé]|coffee|restaurant|bar|grill|pizza|taco|taqueria|brew|brewery|bakery|kitchen|diner|deli|tavern|pub|bbq|bistro|sushi|burger|donut|ice cream)\b/i.test(name) ? 'Food & drink' : 'Other';
  const api = { readFile, parseCsv, placesFromCsv, placesFromGeoJson, visitsFromTimeline, fromUrl, guessKind, MAX_FILE };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---- the import dialog ----
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let host = null, dlg = null, lists = new Map(), visits = [], notes = [], lookup = { running: false, cancel: false, done: 0, total: 0 }, farToo = false;
  const MILES = 60;
  const miles = (a, b) => OrientPlaces.distance(a, b) / 1609.34;
  const key = p => p.list + '\u0001' + p.name + '\u0001' + (p.url || '') + '\u0001' + (p.address || '');
  const allItems = () => [...lists.values()].flat();
  const near = p => p.coordinates && miles(p.coordinates, host.origin()) <= MILES;
  const dupe = p => !!p.coordinates && host.places().some(x => !x.demo && x.name.toLowerCase() === p.name.toLowerCase() && OrientPlaces.distance(x.coordinates, p.coordinates) < 150);

  function ensure() {
    if (dlg) return;
    dlg = document.createElement('dialog'); dlg.id = 'takeout-dialog'; dlg.setAttribute('aria-labelledby', 'tk-title');
    dlg.addEventListener('click', onClick); dlg.addEventListener('change', onChange);
    document.body.append(dlg);
  }
  function chosen() { return allItems().filter(p => p.on !== false && p.coordinates && !dupe(p) && (farToo || near(p) || p.exact)); }
  function paint() {
    const items = allItems(), withLoc = items.filter(p => p.coordinates), need = items.filter(p => !p.coordinates && !p.lookedUp);
    let h = '<div class="panel-heading"><h2 id="tk-title">Bring in from Google</h2><button class="icon-button" data-tk="close" aria-label="Close"><i data-lucide="x"></i></button></div>'
      + '<p class="fine">Your files are read in this browser and are not uploaded. Looking up places that have no location sends only the place name to this computer’s address reader.</p>';
    for (const m of notes) h += '<p class="fine" role="status">' + esc(m) + '</p>';
    if (lists.size) {
      h += '<h3>Places</h3><div class="tk-lists">';
      for (const [name, list] of lists) {
        const loc = list.filter(p => p.coordinates).length;
        h += '<label class="toggle-row"><span>' + esc(name) + '<small>' + list.length + ' places · ' + loc + ' with a location</small></span><input type="checkbox" data-tk-list="' + esc(name) + '"' + (list.every(p => p.off) ? '' : ' checked') + '></label>';
      }
      h += '</div>';
      if (need.length) h += '<p class="fine">' + need.length + ' place' + (need.length === 1 ? ' has' : 's have') + ' no location in the export.</p><div class="settings-actions"><button class="button" type="button" data-tk="lookup"' + (lookup.running ? ' disabled' : '') + '>' + (lookup.running ? 'Looking up ' + lookup.done + ' of ' + lookup.total + '…' : 'Look up ' + Math.min(need.length, 80) + ' by name') + '</button>' + (lookup.running ? '<button class="button" type="button" data-tk="stop">Stop</button>' : '') + '</div>';
      const far = withLoc.filter(p => !p.exact && !near(p) && p.on !== false).length;
      if (far) h += '<label class="toggle-row"><span>Include ' + far + ' looked-up place' + (far === 1 ? '' : 's') + ' more than ' + MILES + ' miles from here<small>Names can match a place in the wrong city.</small></span><input type="checkbox" data-tk="far"' + (farToo ? ' checked' : '') + '></label>';
      const looked = items.filter(p => p.lookedUp && p.coordinates);
      if (looked.length) h += '<details class="fold"><summary><span>Check ' + looked.length + ' looked-up match' + (looked.length === 1 ? '' : 'es') + '</span><i data-lucide="chevron-down"></i></summary>' + looked.map(p => '<label class="toggle-row"><span>' + esc(p.name) + '<small>' + esc(p.matched || '') + '</small></span><input type="checkbox" data-tk-item="' + esc(key(p)) + '"' + (p.on === false ? '' : ' checked') + '></label>').join('') + '</details>';
    }
    if (visits.length) h += '<h3>Timeline visits</h3><label class="toggle-row"><span>Add visits from Timeline<small>' + visits.length.toLocaleString() + ' visits in the file. Only visits within about 75 metres of a place on your map are kept; the rest is discarded unread.</small></span><input type="checkbox" data-tk="visits" checked></label>';
    const n = chosen().length;
    h += '<div class="settings-actions"><button class="button primary" type="button" data-tk="apply"' + (n || visits.length ? '' : ' disabled') + '>' + (n ? 'Add ' + n + ' place' + (n === 1 ? '' : 's') + ' to My Map' : 'Add to My Map') + '</button></div>';
    dlg.innerHTML = h; if (window.lucide) lucide.createIcons();
  }
  async function open(files) {
    ensure(); lists = new Map(); visits = []; notes = []; farToo = false; lookup = { running: false, cancel: false, done: 0, total: 0 };
    for (const f of files) {
      if (f.size > MAX_FILE) { notes.push(f.name + ' is larger than 200 MB. Export just Saved and Maps (your places), or only a recent period of Timeline.'); continue; }
      const r = readFile(f.name, await f.text());
      if (r.type === 'places') { const k = lists.has(r.list) ? r.list + ' (2)' : r.list; r.items.forEach(p => { p.list = k; p.exact = !!p.coordinates; }); lists.set(k, r.items); }
      else if (r.type === 'visits') visits = visits.concat(r.items);
      else notes.push(f.name + ': ' + r.why);
    }
    if (!dlg.open) dlg.showModal(); paint();
  }
  async function doLookup() {
    const todo = allItems().filter(p => !p.coordinates && !p.lookedUp && p.on !== false).slice(0, 80);
    lookup = { running: true, cancel: false, done: 0, total: todo.length }; paint();
    for (const p of todo) {
      if (lookup.cancel) break;
      const q = [p.name, p.address || 'Toledo, OH'].join(', ');
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
          if (res.status === 429) { await new Promise(r => setTimeout(r, 1500)); continue; }
          const data = await res.json(); const hit = (data.results || [])[0];
          p.lookedUp = true; if (hit && Array.isArray(hit.coordinates)) { p.coordinates = hit.coordinates; p.matched = hit.address || hit.name || ''; }
        } catch { p.lookedUp = true; }
        break;
      }
      lookup.done++; if (lookup.done % 3 === 0) paint();
      await new Promise(r => setTimeout(r, 1300));
    }
    lookup.running = false; paint();
  }
  function apply() {
    const s = host.store(), room = Math.max(0, 500 - s.custom.length), picked = chosen().slice(0, room), skipped = chosen().length - picked.length;
    let added = 0;
    for (const p of picked) {
      const kind = guessKind(p.name + ' ' + p.list), id = 'local-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + added);
      s.custom.push({ id, name: p.name, kind, icon: host.icon(kind), coordinates: p.coordinates, address: p.address || p.matched || '', note: p.note || '', demo: false });
      if (!s.saved.includes(id)) s.saved.push(id); added++;
    }
    let vAdded = 0, vPlaces = new Set();
    if (visits.length && !(dlg.querySelector('[data-tk="visits"]') && !dlg.querySelector('[data-tk="visits"]').checked)) {
      const places = host.places().filter(p => !p.demo);
      const seen = new Set();
      for (const v of visits) {
        let best = null, bd = 75;
        for (const p of places) { const d = OrientPlaces.distance(p.coordinates, v.coordinates); if (d < bd) { bd = d; best = p; } }
        if (!best) continue;
        const k = best.id + v.day; if (seen.has(k)) continue; seen.add(k);
        if (host.visitDays(best.id).includes(v.day)) continue;
        host.keepOsm(best.id); host.addVisit(best.id, v.day); vAdded++; vPlaces.add(best.id);
      }
    }
    host.save(); host.render();
    lists = new Map(); visits = [];
    notes = ['Added ' + added + ' place' + (added === 1 ? '' : 's') + (vAdded ? ' and ' + vAdded + ' visit' + (vAdded === 1 ? '' : 's') + ' to ' + vPlaces.size + ' place' + (vPlaces.size === 1 ? '' : 's') : '') + '.' + (skipped > 0 ? ' ' + skipped + ' more didn’t fit: Orient keeps up to 500 personal places.' : '')];
    paint();
  }
  function onClick(e) {
    const b = e.target.closest('[data-tk]'); if (!b) return;
    const a = b.dataset.tk;
    if (a === 'close') dlg.close(); else if (a === 'lookup') doLookup(); else if (a === 'stop') lookup.cancel = true; else if (a === 'apply') apply();
  }
  function onChange(e) {
    const t = e.target;
    if (t.dataset.tkList) { (lists.get(t.dataset.tkList) || []).forEach(p => { p.off = !t.checked; p.on = t.checked; }); paint(); }
    else if (t.dataset.tkItem) { const p = allItems().find(x => key(x) === t.dataset.tkItem); if (p) p.on = t.checked; paint(); }
    else if (t.dataset.tk === 'far') { farToo = t.checked; paint(); }
  }
  function init(h) {
    host = h;
    const input = document.getElementById('takeout-file');
    if (input) input.addEventListener('change', async () => { const files = [...input.files]; input.value = ''; if (files.length) { document.getElementById('settings-dialog')?.close(); await open(files); } });
  }
  root.OrientTakeout = { init, open, readFile };
})(typeof window !== 'undefined' ? window : globalThis);
