'use strict';
/* Pins that would sit on top of each other are drawn as one round "N places" button instead.
   Zooming in (or tapping the button) pulls them apart. Places at the very same spot cannot be pulled apart by zooming, so tapping
   their button opens a small list of them. The place you have open is never folded into a group, and nothing here changes your map:
   it only decides what to draw. */
window.OrientClusters = (() => {
  let api = null, map = null, hooked = false, list = null, listFor = null;
  const clusters = new Map();            // key -> { key, ids, lngLat, marker }
  const RADIUS = 36;                      // pins whose centres are closer than this many pixels are grouped
  const SAME = 0.00003;                   // about three metres: the same place for every purpose
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  // A per-device switch in the field kit (on unless turned off).
  const PREF = 'orient-clusters-v1';
  const enabled = () => { try { return JSON.parse(localStorage.getItem(PREF) || '{}').on !== false; } catch { return true; } };
  function bindSwitch() {
    const box = document.getElementById('clusters-toggle'); if (!box || box.dataset.bound) return; box.dataset.bound = '1';
    box.checked = enabled();
    box.addEventListener('change', () => { try { localStorage.setItem(PREF, JSON.stringify({ on: box.checked })); } catch { /* the switch still applies for this visit */ } update(); });
    document.addEventListener('click', e => { if (e.target.closest('[data-action="settings"]')) box.checked = enabled(); });
  }
  function init(a) { api = a; bindSwitch(); }

  function hook() {
    if (hooked || !map) return; hooked = true;
    const again = () => { closeList(); update(); };
    map.on('moveend', again); map.on('zoomend', again);
    map.on('movestart', closeList); map.on('click', closeList);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && list) { const f = listFor; closeList(); const b = f && clusters.get(f)?.marker.getElement(); if (b) b.focus(); } });
  }

  // ---- grouping ----
  function group(items, selected) {
    const taken = new Set(), groups = [];
    items.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    for (const it of items) {
      if (taken.has(it.id)) continue;
      if (it.id === selected) { taken.add(it.id); continue; }
      const g = [it];
      for (const o of items) {
        if (o === it || taken.has(o.id) || o.id === selected) continue;
        if (Math.hypot(o.pt.x - it.pt.x, o.pt.y - it.pt.y) < RADIUS) g.push(o);
      }
      taken.add(it.id);
      if (g.length > 1) { g.forEach(x => taken.add(x.id)); groups.push(g); }
    }
    return groups;
  }

  function button(c) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'map-cluster';
    b.addEventListener('click', e => { e.stopPropagation(); open(c.key); });
    return b;
  }
  function paint(c) {
    const el = c.marker.getElement(), n = c.ids.length;
    el.classList.toggle('big', n >= 10);
    el.setAttribute('aria-label', `${plural(n, 'place')} here. ${c.same ? 'Open the list.' : 'Zoom in to see them.'}`);
    el.innerHTML = `<b>${n}</b>`;
  }

  // Recompute what is drawn: which pins are folded away, and which round buttons stand in for them.
  function update() {
    map = api && api.map(); if (!map) return; hook();
    const selected = api.selected(), items = [];
    for (const [id, marker] of api.markers()) items.push({ id, marker, el: marker.getElement(), pt: map.project(marker.getLngLat()), priority: id === selected ? 1e6 : api.priority(id) });
    const groups = enabled() ? group(items, selected) : [], folded = new Set(groups.flat().map(x => x.id));
    for (const it of items) it.el.classList.toggle('clustered', folded.has(it.id));

    const want = new Map();
    for (const g of groups) {
      const ids = g.map(x => x.id).sort(), key = ids.join('|'), pts = g.map(x => x.marker.getLngLat());
      const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length, lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
      const same = pts.every(p => Math.abs(p.lng - pts[0].lng) < SAME && Math.abs(p.lat - pts[0].lat) < SAME);
      want.set(key, { key, ids, lngLat: [lng, lat], same });
    }
    for (const [key, c] of clusters) if (!want.has(key)) { c.marker.remove(); clusters.delete(key); if (listFor === key) closeList(); }
    for (const [key, w] of want) {
      let c = clusters.get(key);
      if (!c) { c = { ...w }; c.marker = new maplibregl.Marker({ element: button(c), anchor: 'center' }).setLngLat(w.lngLat).addTo(map); clusters.set(key, c); }
      else { c.lngLat = w.lngLat; c.same = w.same; c.marker.setLngLat(w.lngLat); }
      paint(c);
    }
    if (window.OrientMapLabels) OrientMapLabels.refresh();
  }

  // ---- what a tap does ----
  function open(key) {
    const c = clusters.get(key); if (!c || !map) return;
    const pts = c.ids.map(id => api.markers().get(id)?.getLngLat()).filter(Boolean);
    if (!pts.length) return;
    if (c.same || map.getZoom() >= 18) { showList(c); return; }
    const b = pts.reduce((bb, p) => bb.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
    map.fitBounds(b, { padding: 100, maxZoom: 18, duration: reduced() ? 0 : 450 });
  }
  function closeList() { if (list) { list.remove(); list = null; listFor = null; } }
  function showList(c) {
    closeList();
    const wrap = document.createElement('div'); wrap.className = 'cluster-list'; wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', plural(c.ids.length, 'place') + ' here');
    wrap.innerHTML = `<strong>${esc(plural(c.ids.length, 'place'))} here</strong><ul>${c.ids.map(id => { const i = api.info(id) || { name: id, kind: '' }; return `<li><button type="button" data-cluster-pick="${esc(id)}"><span>${esc(i.name)}</span><small>${esc(i.kind || '')}</small></button></li>`; }).join('')}</ul>`;
    wrap.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-cluster-pick]'); if (b) { const id = b.dataset.clusterPick; closeList(); api.select(id); } });
    const p = map.project(c.lngLat), box = map.getContainer().getBoundingClientRect();
    wrap.style.left = Math.max(8, Math.min(box.width - 228, p.x - 110)) + 'px'; wrap.style.top = Math.max(8, Math.min(box.height - 40, p.y + 30)) + 'px';
    map.getContainer().append(wrap); list = wrap; listFor = c.key;
    const first = wrap.querySelector('button'); if (first) first.focus();
  }

  // Where the round buttons are on screen, so names under nearby pins can stay clear of them.
  function points() { if (!map) return []; return [...clusters.values()].map(c => { const p = map.project(c.lngLat); return { x: p.x, y: p.y }; }); }
  const status = () => ({ clusters: [...clusters.values()].map(c => ({ ids: c.ids.slice(), same: c.same })), folded: document.querySelectorAll('.map-marker.clustered').length });
  return { init, update, enabled, points, status, open: key => open(key), _keys: () => [...clusters.keys()] };
})();
