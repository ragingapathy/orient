'use strict';
/* Road work and closures: what is under construction and which roads are closed, drawn on the map and listed.
   The data is a small public file (roadwork.json) that a commons repository refreshes every half hour from the state's own
   Work Zone Data Exchange feed (Ohio's OHGO, Michigan's, and so on; see commons-template/). Orient only downloads that one
   static file. No location, account or key is sent, and nothing here is for navigation: it is context for your city. */
window.OrientRoadwork = (() => {
  const PREF = 'orient-roadwork-v1', CACHE = 'orient-roadwork-cache-v1', FRESH = 10 * 60e3, OLD = 3 * 3600e3;
  // Areas with a road-work file. Anyone running a commons for their own region can add a line.
  const SOURCES = [{ name: 'Toledo region', center: [-83.539, 41.655], km: 90, url: 'https://raw.githubusercontent.com/ragingapathy/toledo-commons/roadwork-data/roadwork.json' }];
  const LAYERS = ['orient-roadwork-hit', 'orient-roadwork-casing', 'orient-roadwork-solid', 'orient-roadwork-dash', 'orient-roadwork-points'];
  const SRC = 'orient-roadwork';
  const STATUS = { closed: 'Closed', restricted: 'Lane restrictions', unknown: 'Work zones', open: 'Lanes open' };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jget = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage can be blocked; the file is just fetched again */ } };
  const prefs = () => ({ show: true, ...jget(PREF, {}) });

  let api = null, data = null, source = null, dialog = null, timer = null, mapTries = 0, drawn = false, focusId = '', more = {};

  // ----- the file, checked as strictly as anything that arrives from outside -----
  const str = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
  const iso = v => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return Number.isFinite(t) ? new Date(t).toISOString() : ''; };
  const pt = c => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 85;
  function validate(raw) {
    if (!raw || raw.format !== 'orient-roadwork' || raw.version !== 1 || !Array.isArray(raw.items)) return null;
    const items = [];
    for (const i of raw.items.slice(0, 800)) {
      if (!i || typeof i !== 'object' || !STATUS[i.status] || !Array.isArray(i.geometry)) continue;
      const geometry = i.geometry.filter(pt).slice(0, 60).map(c => [c[0], c[1]]); if (!geometry.length) continue;
      items.push({ id: str(i.id, 100) || 'item-' + items.length, status: i.status, roads: (Array.isArray(i.roads) ? i.roads : []).map(r => str(r, 40)).filter(Boolean).slice(0, 4), direction: str(i.direction, 24), description: str(i.description, 260), from: str(i.from, 80), to: str(i.to, 80), start: iso(i.start), end: iso(i.end), upcoming: i.upcoming === true, geometry });
    }
    const sources = (Array.isArray(raw.sources) ? raw.sources : []).slice(0, 8).map(s => ({ name: str(s && s.name, 80), publisher: str(s && s.publisher, 80), license: str(s && s.license, 24), homepage: /^https:\/\//.test(s && s.homepage || '') ? str(s.homepage, 200) : '', status: ['ok', 'stale', 'failed', 'skipped'].includes(s && s.status) ? s.status : 'failed', fetched: iso(s && s.fetched) }));
    return { updated: iso(raw.updated), sources, items };
  }

  // ----- which file belongs to this area -----
  const origin = () => { const o = api && api.origin && api.origin(); return o && o.length === 2 && o.every(Number.isFinite) ? o : null; };
  function sourceFor(o) { if (!o) return null; let best = null, bd = Infinity; for (const s of SOURCES) { const d = OrientPlaces.distance(o, s.center); if (d <= s.km * 1000 && d < bd) { best = s; bd = d; } } return best; }
  const nearest = item => { const o = origin(); return o ? Math.min(...item.geometry.map(c => OrientPlaces.distance(o, c))) : Infinity; };
  const miles = m => (m / 1609.344);
  const near = (item, km) => nearest(item) <= km * 1000;

  // ----- the map layer -----
  const feature = (i, kind, coords) => ({ type: 'Feature', properties: { id: i.id, status: i.status, upcoming: i.upcoming }, geometry: kind === 'Point' ? { type: 'Point', coordinates: coords } : { type: 'LineString', coordinates: coords } });
  function geojson() {
    const features = [];
    for (const i of data ? data.items : []) { if (i.geometry.length > 1) features.push(feature(i, 'Line', i.geometry)); features.push(feature(i, 'Point', i.geometry[0])); }
    return { type: 'FeatureCollection', features };
  }
  function clearMap() {
    const map = api.map && api.map(); if (!map) return;
    try { for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id); if (map.getSource(SRC)) map.removeSource(SRC); } catch { /* the map may be mid-load */ }
    drawn = false;
  }
  function draw() {
    const map = api.map && api.map();
    if (!map) { if (mapTries++ < 100) setTimeout(draw, 300); return; }
    if (!(prefs().show && data && data.items.length)) { clearMap(); return; }
    if (!map.isStyleLoaded()) { map.once('idle', draw); return; }
    const gj = geojson(), have = map.getSource(SRC);
    if (have) { have.setData(gj); drawn = true; return; }
    const colour = ['match', ['get', 'status'], 'closed', '#c0392b', 'restricted', '#e08a2c', 'open', '#7d9a6b', '#8a8f94'];
    const lines = ['==', ['geometry-type'], 'LineString'], points = ['==', ['geometry-type'], 'Point'];
    map.addSource(SRC, { type: 'geojson', data: gj });
    map.addLayer({ id: 'orient-roadwork-hit', type: 'line', source: SRC, filter: lines, paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 18 } });
    map.addLayer({ id: 'orient-roadwork-casing', type: 'line', source: SRC, filter: lines, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 4, 14, 10] } });
    map.addLayer({ id: 'orient-roadwork-solid', type: 'line', source: SRC, filter: ['all', lines, ['any', ['==', ['get', 'status'], 'closed'], ['==', ['get', 'status'], 'open']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colour, 'line-opacity': ['case', ['get', 'upcoming'], 0.45, 1], 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.2, 14, 6] } });
    map.addLayer({ id: 'orient-roadwork-dash', type: 'line', source: SRC, filter: ['all', lines, ['!', ['any', ['==', ['get', 'status'], 'closed'], ['==', ['get', 'status'], 'open']]]], layout: { 'line-join': 'round' }, paint: { 'line-color': colour, 'line-opacity': ['case', ['get', 'upcoming'], 0.45, 1], 'line-dasharray': [1.6, 1.1], 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.2, 14, 6] } });
    map.addLayer({ id: 'orient-roadwork-points', type: 'circle', source: SRC, filter: points, paint: { 'circle-color': colour, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3.5, 14, 7], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2, 'circle-opacity': ['case', ['get', 'upcoming'], 0.55, 1] } });
    for (const id of ['orient-roadwork-hit', 'orient-roadwork-points']) {
      map.on('click', id, e => { const f = e.features && e.features[0]; if (f) open(f.properties.id); });
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    }
    drawn = true;
  }

  // ----- fetching -----
  const age = () => data && data.updated ? Date.now() - Date.parse(data.updated) : Infinity;
  async function refresh(force = false) {
    if (!api) return;
    source = sourceFor(origin());
    if (!prefs().show || !source) { data = null; clearMap(); everywhere(); return; }
    const cache = jget(CACHE, null);
    if (!force && cache && cache.url === source.url && Date.now() - cache.at < FRESH) { data = validate(cache.raw); everywhere(); return; }
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(source.url, { signal: ctl.signal, cache: 'no-cache' }).finally(() => clearTimeout(t));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const raw = await r.json(), ok = validate(raw);
      if (!ok) throw new Error('not a road-work file');
      data = ok; jset(CACHE, { url: source.url, at: Date.now(), raw });
    } catch { data = cache && cache.url === source.url ? validate(cache.raw) : null; }
    everywhere();
  }

  // ----- the button, the Today line and the list -----
  const counts = () => {
    const c = { closed: 0, restricted: 0, soon: 0 };
    for (const i of data ? data.items : []) { if (!near(i, 25)) continue; if (i.upcoming) c.soon++; else if (i.status === 'closed') c.closed++; else if (i.status === 'restricted') c.restricted++; }
    return c;
  };
  function setTool() {
    const tools = document.getElementById('tools'); let b = document.getElementById('roadwork-tool');
    if (!data || !prefs().show) { b && b.remove(); return; }
    if (!b) { b = document.createElement('button'); b.id = 'roadwork-tool'; b.type = 'button'; b.className = 'icon-button'; b.dataset.roadwork = 'open'; tools && tools.prepend(b); }
    const c = counts();
    b.innerHTML = '<i data-lucide="construction" aria-hidden="true"></i>' + (c.closed ? '<span class="rw-dot" aria-hidden="true"></span>' : '');
    b.setAttribute('aria-label', 'Road work and closures' + (c.closed ? ': ' + c.closed + ' closed nearby' : ''));
    try { window.lucide && window.lucide.createIcons(); } catch { /* decoration */ }
  }
  function dressToday() {
    const panel = document.getElementById('panel'); if (!panel) return;
    const heading = panel.querySelector('.today-heading'), old = panel.querySelector('.roadwork-strip');
    const c = data && prefs().show ? counts() : null;
    if (!c || (!c.closed && !c.restricted) || !heading) { old && old.remove(); return; }
    const bits = []; if (c.closed) bits.push(c.closed + (c.closed === 1 ? ' road closed' : ' roads closed')); if (c.restricted) bits.push(c.restricted + (c.restricted === 1 ? ' lane restriction' : ' lane restrictions'));
    const html = '<i data-lucide="construction" class="rw-ico" aria-hidden="true"></i><span class="rw-copy"><b>' + esc(bits.join(' · ')) + '</b><small>Within about 15 miles' + (c.soon ? ' · ' + c.soon + ' more starting soon' : '') + '</small></span><span class="wx-go" aria-hidden="true">›</span>';
    if (old) { if (old.dataset.html !== html) { old.innerHTML = html; old.dataset.html = html; try { window.lucide && window.lucide.createIcons(); } catch { /* decoration */ } } return; }
    const s = document.createElement('button'); s.type = 'button'; s.className = 'roadwork-strip'; s.dataset.roadwork = 'open'; s.dataset.html = html; s.innerHTML = html; s.dataset.tone = c.closed ? 'closed' : 'restricted';
    (panel.querySelector('.weather-strip') || heading).after(s); try { window.lucide && window.lucide.createIcons(); } catch { /* decoration */ }
  }
  function everywhere() { draw(); setTool(); dressToday(); if (dialog && dialog.open) render(); syncSettings(); }

  const dir = d => d ? d.charAt(0).toUpperCase() + d.slice(1) : '';
  const shortDate = s => new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const dates = i => i.upcoming ? 'Starts ' + shortDate(i.start) + (i.end ? ', until ' + shortDate(i.end) : '') : i.end ? 'Until ' + shortDate(i.end) : i.start ? 'Since ' + shortDate(i.start) : '';
  const span = ms => { const m = Math.round(ms / 60000); return m < 2 ? 'under a minute' : m < 90 ? m + ' minutes' : Math.round(m / 60) + ' hours'; };
  const ago = ms => Math.round(ms / 60000) < 2 ? 'just now' : span(ms) + ' ago';
  function card(i) {
    const title = (i.roads.join(' / ') || 'Road work') + (i.direction ? ' · ' + dir(i.direction) : ''), seg = i.from && i.to ? i.from + ' to ' + i.to : i.from || i.to || '';
    const d = nearest(i);
    return '<article class="rw-card" data-status="' + i.status + '"' + (i.id === focusId ? ' data-focus="1"' : '') + ' data-id="' + esc(i.id) + '"><span class="rw-tile" aria-hidden="true"><i data-lucide="' + (i.status === 'closed' ? 'octagon-x' : 'construction') + '"></i></span><div><b>' + esc(title) + '</b>' +
      (seg ? '<small>' + esc(seg) + '</small>' : '') + (i.description ? '<p>' + esc(i.description) + '</p>' : '') + '<small class="rw-meta">' + esc([dates(i), Number.isFinite(d) ? miles(d).toFixed(1) + ' mi away' : ''].filter(Boolean).join(' · ')) + '</small></div><button type="button" class="button" data-roadwork="show" data-id="' + esc(i.id) + '" aria-label="Show ' + esc(title) + ' on the map">Show</button></article>';
  }
  function render() {
    if (!dialog) return;
    const body = dialog.querySelector('[data-rw-body]'); if (!data) { body.innerHTML = '<p class="sub">Road work isn’t available right now.</p>'; return; }
    const items = data.items.filter(i => near(i, 80)).sort((a, b) => nearest(a) - nearest(b)), c = counts();
    const groups = [['closed', 'Closed', items.filter(i => i.status === 'closed' && !i.upcoming)], ['restricted', 'Lane restrictions', items.filter(i => (i.status === 'restricted' || i.status === 'unknown') && !i.upcoming)], ['soon', 'Starting soon', items.filter(i => i.upcoming)], ['open', 'Work nearby, lanes open', items.filter(i => i.status === 'open' && !i.upcoming)]];
    if (focusId) for (const g of groups) { const k = g[2].findIndex(i => i.id === focusId); if (k > 0) g[2].unshift(...g[2].splice(k, 1)); }
    const stale = age() > OLD, srcs = data.sources.filter(s => s.status !== 'skipped');
    body.innerHTML = '<div class="rw-tiles"><div class="ui-tile orange"><b>' + c.closed + '</b><span>closed within 15 mi</span></div><div class="ui-tile gold"><b>' + c.restricted + '</b><span>lane restrictions</span></div><div class="ui-tile teal"><b>' + c.soon + '</b><span>starting soon</span></div></div>' +
      (stale ? '<p class="rw-warn" role="status">This information is ' + esc(span(age())) + ' old and may be out of date.</p>' : '') +
      groups.map(([k, label, list]) => list.length ? '<section class="rw-section"><h3 class="ui-kicker">' + label + ' · ' + list.length + '</h3>' + list.slice(0, more[k] ? 80 : 12).map(card).join('') + (list.length > 12 && !more[k] ? '<button type="button" class="button full" data-roadwork="more" data-group="' + k + '">Show all ' + list.length + '</button>' : '') + '</section>' : '').join('') +
      (items.length ? '' : '<p class="rw-empty">Nothing is listed for this area right now.</p>') +
      '<p class="fine">Updated ' + esc(data.updated ? ago(age()) : 'at an unknown time') + ', from ' + (srcs.length ? srcs.map(s => (s.homepage ? '<a href="' + esc(s.homepage) + '" target="_blank" rel="noopener">' + esc(s.publisher || s.name) + '</a>' : esc(s.publisher || s.name)) + (s.status === 'stale' ? ' (last good copy)' : '') + (s.license ? ', ' + esc(s.license) : '')).join('; ') : 'public road-work feeds') + '. This is for awareness, not navigation: closures change quickly, so trust signs and the agency’s own map when you drive. Orient fetches one public file and sends nothing about you.</p>';
    try { window.lucide && window.lucide.createIcons(); } catch { /* decoration */ }
    const f = body.querySelector('[data-focus]'); if (f) f.scrollIntoView({ block: 'nearest' });
  }
  function open(id = '') {
    if (!data) return; focusId = id; more = {};
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = 'roadwork-dialog'; dialog.setAttribute('aria-labelledby', 'roadwork-title');
      dialog.innerHTML = '<div class="panel-heading"><div><span class="ui-kicker">Road work</span><h2 id="roadwork-title">Closures and construction</h2></div><button type="button" class="icon-button" data-roadwork="close" aria-label="Close road work"><i data-lucide="x"></i></button></div><div data-rw-body></div>';
      document.body.append(dialog);
    }
    render(); if (!dialog.open) dialog.showModal(); try { window.lucide && window.lucide.createIcons(); } catch { /* decoration */ }
  }
  function show(id) {
    const item = data && data.items.find(i => i.id === id), map = api.map && api.map(); if (!item || !map) return;
    dialog && dialog.close();
    const xs = item.geometry.map(c => c[0]), ys = item.geometry.map(c => c[1]);
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 90, maxZoom: 15.5, duration: 600 });
  }
  function onClick(e) {
    const b = e.target.closest('[data-roadwork]'); if (!b) return; const a = b.dataset.roadwork;
    if (a === 'open') open(); else if (a === 'close') dialog && dialog.close(); else if (a === 'show') show(b.dataset.id); else if (a === 'more') { more[b.dataset.group] = true; render(); }
  }
  function syncSettings() {
    const box = document.getElementById('roadwork-toggle'); if (!box) return;
    const none = !source, note = document.getElementById('roadwork-note');
    box.checked = prefs().show && !none; box.disabled = none;
    if (note) note.textContent = none ? 'No road-work source covers this area yet.' : 'Closures and work zones from the state’s public feed, refreshed every half hour. Orient downloads one public file; nothing about you is sent.';
  }
  function bindSettings() {
    const box = document.getElementById('roadwork-toggle'); if (!box || box.dataset.bound) return; box.dataset.bound = '1';
    box.addEventListener('change', () => { const p = prefs(); p.show = box.checked; jset(PREF, p); refresh(true); });
    document.addEventListener('click', e => { if (e.target.closest('[data-action="settings"]')) syncSettings(); });
  }

  function init(a) {
    api = a; document.addEventListener('click', onClick); bindSettings();
    new MutationObserver(() => dressToday()).observe(document.getElementById('panel') || document.body, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    clearInterval(timer); timer = setInterval(() => { if (!document.hidden) refresh(); }, FRESH);
    refresh();
  }
  return { init, refresh, open, validate, view: () => { const m = api.map && api.map(); return m ? { center: m.getCenter().toArray(), zoom: m.getZoom() } : null; }, project: (lng, lat) => { const m = api.map && api.map(); if (!m) return null; const p = m.project([lng, lat]), r = m.getCanvas().getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; }, state: () => ({ source: source && source.name, items: data ? data.items.length : 0, drawn }), mapLayers: () => { const m = api.map && api.map(); if (!m || !m.getSource(SRC)) return null; return { layers: LAYERS.filter(id => m.getLayer(id)), features: m.getSource(SRC).serialize().data.features.length }; } };
})();
