'use strict';
/* The Civic tab: what is happening in the city right now, on one screen and on the map.
   Weather and alerts, road work and closures (roadwork.js), incidents, state traffic cameras, and the license plate readers that
   volunteers have mapped on OpenStreetMap (the data DeFlock maps). Everything comes from a few small public files a commons
   repository refreshes (commons-template/); Orient only downloads those files. No location, account or key is sent.
   Camera pictures load straight from the state's own server, and only when you ask to see a camera. */
window.OrientBoard = (() => {
  const PREF = 'orient-civic-v1', CACHE = 'orient-civic-cache-v1';
  const FILES = { incidents: 'incidents.json', cameras: 'cameras.json', alpr: 'alpr.json' };
  const FORMATS = { incidents: 'orient-incidents', cameras: 'orient-cameras', alpr: 'orient-alpr' };
  const TTL = { incidents: 10 * 60e3, cameras: 6 * 3600e3, alpr: 12 * 3600e3 };
  const LABEL = { incidents: 'Incidents', cameras: 'Traffic cameras', alpr: 'Plate readers' };
  const SRC = { incidents: 'orient-incidents', cameras: 'orient-cameras', alpr: 'orient-alpr' };
  const HOVER = 'orient-civic-hover';
  const HIT = ['orient-roadwork-hit', 'orient-roadwork-points', 'orient-incident-line-hit', 'orient-incident-pt', 'orient-camera-pt', 'orient-camera-cluster', 'orient-alpr-pt', 'orient-alpr-pt-nodir', 'orient-alpr-cluster'];
  const OWN_CLICK = ['orient-incident-line-hit', 'orient-incident-pt', 'orient-camera-pt', 'orient-camera-cluster', 'orient-alpr-pt', 'orient-alpr-pt-nodir', 'orient-alpr-cluster'];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jget = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage can be blocked; files are just fetched again */ } };
  const prefs = () => ({ incidents: true, cameras: null, alpr: null, ...jget(PREF, {}) });
  const paint = () => { try { window.lucide && window.lucide.createIcons(); } catch { /* decoration */ } };

  let closuresView = false;
  let api = null, data = {}, meta = {}, loading = {}, tried = {}, hoverEl = null, dialog = null, camTimer = 0, bound = null, redrawSoon = 0;
  const tab = () => (api && api.tab ? api.tab() : '');
  const map = () => (api && api.map ? api.map() : null);
  const origin = () => { const o = api && api.origin && api.origin(); return o && o.length === 2 && o.every(Number.isFinite) ? o : null; };
  const base = () => { const s = window.OrientRoadwork && OrientRoadwork.source && OrientRoadwork.source(); return s ? s.base : null; };
  const dist = (a, b) => OrientPlaces.distance(a, b);
  const miles = m => m / 1609.344;
  const away = m => Number.isFinite(m) ? (m < 160 ? 'right here' : miles(m).toFixed(1) + ' mi away') : '';
  // a layer is on if you chose so; if you never chose, it is on only while you are on the Civic tab
  const layerOn = name => { if (closuresView) return name === 'incidents'; const v = prefs()[name]; return v === null || v === undefined ? tab() === 'Civic' : !!v; };
  const roadworkOn = () => !!(window.OrientRoadwork && OrientRoadwork.shown && OrientRoadwork.shown());

  // ----- the files, checked as strictly as anything that arrives from outside -----
  const str = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '';
  const pos = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 85 && Math.abs(lng) <= 180;
  const https = v => { try { const u = new URL(String(v)); return u.protocol === 'https:' && String(v).length <= 400 ? u.toString() : ''; } catch { return ''; } };
  const iso = v => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return Number.isFinite(t) ? new Date(t).toISOString() : ''; };
  function validate(name, raw) {
    if (!raw || raw.format !== FORMATS[name] || raw.version !== 1 || !Array.isArray(raw.items)) return null;
    const s = raw.source || {}, source = { name: str(s.name, 80), publisher: str(s.publisher, 80), homepage: /^https:\/\//.test(s.homepage || '') ? str(s.homepage, 200) : '', license: str(s.license, 30), attribution: str(s.attribution, 80), status: ['ok', 'stale', 'failed', 'skipped'].includes(s.status) ? s.status : 'failed', fetched: iso(s.fetched), dataAsOf: iso(s.dataAsOf) };
    const items = [];
    for (const i of raw.items.slice(0, name === 'alpr' ? 3000 : 800)) {
      if (!i || typeof i !== 'object' || !pos(i.lat, i.lng)) continue;
      const id = str(i.id, 80); if (!id) continue;
      if (name === 'incidents') items.push({ id, lat: i.lat, lng: i.lng, category: str(i.category, 40), route: str(i.route, 60), direction: str(i.direction, 24), location: str(i.location, 120), description: str(i.description, 300), status: ['closed', 'partial', 'open', 'unknown'].includes(i.status) ? i.status : 'unknown', polyline: (Array.isArray(i.polyline) ? i.polyline : []).filter(c => Array.isArray(c) && pos(c[1], c[0])).slice(0, 40).map(c => [c[0], c[1]]) });
      else if (name === 'cameras') { const views = (Array.isArray(i.views) ? i.views : []).slice(0, 6).map(v => ({ direction: str(v && v.direction, 24), route: str(v && v.route, 80), small: https(v && v.small), large: https(v && v.large) })).filter(v => v.small || v.large); if (views.length) items.push({ id, lat: i.lat, lng: i.lng, location: str(i.location, 120), description: str(i.description, 160), views }); }
      else items.push({ id, lat: i.lat, lng: i.lng, direction: Number.isFinite(i.direction) ? ((Math.round(i.direction) % 360) + 360) % 360 : null, manufacturer: str(i.manufacturer, 60), operator: str(i.operator, 80), zone: str(i.zone, 30), mount: str(i.mount, 30), kind: str(i.kind, 20), model: str(i.model, 60) });
    }
    return { updated: iso(raw.updated), source, items };
  }
  async function load(name, force = false) {
    const b = base(); if (!b) { data[name] = null; return null; }
    const cache = jget(CACHE, {})[name], url = b + FILES[name];
    if (!force && cache && cache.url === url && Date.now() - cache.at < TTL[name]) { const v = validate(name, cache.raw); if (v) { data[name] = v; return v; } }
    if (loading[name]) return loading[name];
    loading[name] = (async () => {
      tried[name] = Date.now();
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
        const r = await fetch(url, { signal: ctl.signal, cache: 'no-cache' }).finally(() => clearTimeout(t));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const raw = await r.json(), v = validate(name, raw); if (!v) throw new Error('not a ' + name + ' file');
        data[name] = v; const all = jget(CACHE, {}); all[name] = { url, at: Date.now(), raw }; jset(CACHE, all);
      } catch { const v = cache && cache.url === url ? validate(name, cache.raw) : null; data[name] = v || data[name] || null; }
      finally { loading[name] = null; }
      changed(); return data[name];
    })();
    return loading[name];
  }
  // fetch only what is wanted: the layers that are on, and everything while you are on the Civic tab
  function ensure() { for (const n of Object.keys(FILES)) if ((layerOn(n) || tab() === 'Civic') && !loading[n] && (data[n] === undefined || (data[n] === null && Date.now() - (tried[n] || 0) > 60000))) load(n); }
  function changed() { clearTimeout(redrawSoon); redrawSoon = setTimeout(() => { drawAll(); if (tab() === 'Civic' && !document.querySelector('dialog[open]') && api.render) { try { api.render(); } catch { /* the next change draws it */ } } }, 40); }

  // ----- the map layer -----
  const ctxImage = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); draw(x, size); return x.getImageData(0, 0, size, size); };
  const disc = (x, s, fill) => { x.beginPath(); x.arc(s / 2, s / 2, s / 2 - 3, 0, 6.283); x.fillStyle = fill; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke(); };
  const tri = (x, s, fill) => { x.beginPath(); x.moveTo(s / 2, 4); x.lineTo(s - 4, s - 6); x.lineTo(4, s - 6); x.closePath(); x.fillStyle = fill; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.lineJoin = 'round'; x.stroke(); x.fillStyle = '#fff'; x.fillRect(s / 2 - 2, s * 0.38, 4, s * 0.26); x.beginPath(); x.arc(s / 2, s * 0.76, 2.6, 0, 6.283); x.fill(); };
  function images(m) {
    if (m.hasImage('civic-camera')) return;
    const add = (id, img) => m.addImage(id, img, { pixelRatio: 2 });
    add('civic-camera', ctxImage(52, (x, s) => { disc(x, s, '#2f6f9f'); x.fillStyle = '#fff'; x.beginPath(); x.roundRect(13, 19, 22, 15, 3); x.fill(); x.beginPath(); x.moveTo(35, 24); x.lineTo(41, 20); x.lineTo(41, 33); x.lineTo(35, 29); x.fill(); x.beginPath(); x.arc(22, 26.5, 4, 0, 6.283); x.fillStyle = '#2f6f9f'; x.fill(); }));
    add('civic-alpr', ctxImage(52, (x, s) => { disc(x, s, '#7a3b8f'); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(s / 2, 9); x.lineTo(s / 2 + 11, s - 13); x.lineTo(s / 2, s - 19); x.lineTo(s / 2 - 11, s - 13); x.closePath(); x.fill(); }));
    add('civic-alpr-nodir', ctxImage(52, (x, s) => { disc(x, s, '#7a3b8f'); x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.arc(s / 2, s / 2, 8, 0, 6.283); x.stroke(); x.fillStyle = '#fff'; x.beginPath(); x.arc(s / 2, s / 2, 3, 0, 6.283); x.fill(); }));
    add('civic-incident-closed', ctxImage(52, (x, s) => tri(x, s, '#c0392b')));
    add('civic-incident-partial', ctxImage(52, (x, s) => tri(x, s, '#e08a2c')));
    add('civic-incident-open', ctxImage(52, (x, s) => tri(x, s, '#8a8f94')));
  }
  const point = (i, props) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [i.lng, i.lat] } });
  const collections = {
    incidents: d => ({ type: 'FeatureCollection', features: d.items.flatMap(i => [point(i, { id: i.id, status: i.status, kind: 'incident' }), ...(i.polyline.length > 1 ? [{ type: 'Feature', properties: { id: i.id, status: i.status, kind: 'incident' }, geometry: { type: 'LineString', coordinates: i.polyline } }] : [])]) }),
    cameras: d => ({ type: 'FeatureCollection', features: d.items.map(i => point(i, { id: i.id, kind: 'camera' })) }),
    alpr: d => ({ type: 'FeatureCollection', features: d.items.map(i => point(i, { id: i.id, kind: 'alpr', dir: i.direction === null ? 0 : i.direction, hasDir: i.direction !== null })) }),
  };
  const sz = ['interpolate', ['linear'], ['zoom'], 9, 0.55, 14, 0.85];
  function build(m, name) {
    const lines = ['==', ['geometry-type'], 'LineString'], pts = ['all', ['==', ['geometry-type'], 'Point'], ['!', ['has', 'point_count']]];
    if (name === 'incidents') {
      m.addSource(SRC.incidents, { type: 'geojson', data: collections.incidents(data.incidents) });
      m.addLayer({ id: 'orient-incident-line-hit', type: 'line', source: SRC.incidents, filter: lines, paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 18 } });
      m.addLayer({ id: 'orient-incident-line', type: 'line', source: SRC.incidents, filter: lines, layout: { 'line-cap': 'round' }, paint: { 'line-color': ['match', ['get', 'status'], 'closed', '#c0392b', 'partial', '#e08a2c', '#8a8f94'], 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 7], 'line-opacity': 0.85 } });
      m.addLayer({ id: 'orient-incident-pt', type: 'symbol', source: SRC.incidents, filter: ['==', ['geometry-type'], 'Point'], layout: { 'icon-image': ['match', ['get', 'status'], 'closed', 'civic-incident-closed', 'partial', 'civic-incident-partial', 'civic-incident-open'], 'icon-size': sz, 'icon-allow-overlap': true } });
    } else if (name === 'cameras') {
      m.addSource(SRC.cameras, { type: 'geojson', data: collections.cameras(data.cameras), cluster: true, clusterRadius: 38, clusterMaxZoom: 11 });
      m.addLayer({ id: 'orient-camera-cluster', type: 'circle', source: SRC.cameras, filter: ['has', 'point_count'], paint: { 'circle-color': '#2f6f9f', 'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 30, 22], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } });
      m.addLayer({ id: 'orient-camera-cluster-count', type: 'symbol', source: SRC.cameras, filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#fff' } });
      m.addLayer({ id: 'orient-camera-pt', type: 'symbol', source: SRC.cameras, filter: pts, layout: { 'icon-image': 'civic-camera', 'icon-size': sz, 'icon-allow-overlap': true } });
    } else if (name === 'alpr') {
      m.addSource(SRC.alpr, { type: 'geojson', data: collections.alpr(data.alpr), cluster: true, clusterRadius: 34, clusterMaxZoom: 12 });
      m.addLayer({ id: 'orient-alpr-cluster', type: 'circle', source: SRC.alpr, filter: ['has', 'point_count'], paint: { 'circle-color': '#7a3b8f', 'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 40, 22], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } });
      m.addLayer({ id: 'orient-alpr-cluster-count', type: 'symbol', source: SRC.alpr, filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#fff' } });
      m.addLayer({ id: 'orient-alpr-pt', type: 'symbol', source: SRC.alpr, filter: ['all', pts, ['==', ['get', 'hasDir'], true]], layout: { 'icon-image': 'civic-alpr', 'icon-rotate': ['get', 'dir'], 'icon-rotation-alignment': 'map', 'icon-size': sz, 'icon-allow-overlap': true } });
      m.addLayer({ id: 'orient-alpr-pt-nodir', type: 'symbol', source: SRC.alpr, filter: ['all', pts, ['==', ['get', 'hasDir'], false]], layout: { 'icon-image': 'civic-alpr-nodir', 'icon-size': sz, 'icon-allow-overlap': true } });
    }
  }
  const LAYER_IDS = { incidents: ['orient-incident-line-hit', 'orient-incident-line', 'orient-incident-pt'], cameras: ['orient-camera-cluster', 'orient-camera-cluster-count', 'orient-camera-pt'], alpr: ['orient-alpr-cluster', 'orient-alpr-cluster-count', 'orient-alpr-pt', 'orient-alpr-pt-nodir'] };
  function drawAll() {
    const m = map(); if (!m || !api) return;
    if (!m.isStyleLoaded()) { m.once('idle', drawAll); return; }
    try {
      images(m);
      for (const name of Object.keys(FILES)) {
        const on = layerOn(name) && base() && data[name];
        if (on && !m.getSource(SRC[name])) build(m, name);
        else if (on) m.getSource(SRC[name]).setData(collections[name](data[name]));
        for (const id of LAYER_IDS[name]) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
      }
      bind(m);
    } catch { /* the map may be mid-load; the next change draws it */ }
  }

  // ----- hover cards and taps -----
  const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  const facing = d => d === null || d === undefined ? 'direction not recorded' : 'faces ' + COMPASS[Math.round(d / 45) % 8] + ' (' + d + '°)';
  const clip = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
  const byId = (name, id) => data[name] && data[name].items.find(i => i.id === id);
  const STATUS_WORD = { closed: 'Closed', partial: 'Partly closed', open: 'Open', unknown: 'Reported' };
  const RW = { closed: 'Closed', restricted: 'Lane restriction', unknown: 'Work zone', open: 'Lanes open' };
  function hoverHTML(f) {
    const p = f.properties, o = origin(), m = (it) => o ? dist(o, [it.lng, it.lat]) : NaN;
    if (f.layer.id.startsWith('orient-roadwork')) {
      const d = window.OrientRoadwork && OrientRoadwork.describe(p.id); if (!d) return '';
      return '<span class="rb-chip" data-k="' + d.status + '">' + esc(d.upcoming ? 'Starting soon' : RW[d.status] || 'Road work') + '</span><b>' + esc(d.title) + '</b>' + (d.seg ? '<small>' + esc(d.seg) + '</small>' : '') + (d.description ? '<p>' + esc(clip(d.description, 150)) + '</p>' : '') + '<small>' + esc([d.when, away(d.meters)].filter(Boolean).join(' · ')) + '</small>';
    }
    if (p.cluster) return '<b>' + p.point_count + (f.layer.id.includes('camera') ? ' traffic cameras' : ' plate readers') + ' here</b><small>Click to zoom in</small>';
    if (p.kind === 'incident') { const i = byId('incidents', p.id); if (!i) return ''; return '<span class="rb-chip" data-k="' + i.status + '">' + esc(i.category || 'Incident') + ' · ' + STATUS_WORD[i.status] + '</span><b>' + esc([i.route, i.direction && i.direction.charAt(0).toUpperCase() + i.direction.slice(1)].filter(Boolean).join(' · ') || i.location || 'Incident') + '</b>' + (i.description ? '<p>' + esc(clip(i.description, 150)) + '</p>' : '') + '<small>' + esc(away(m(i))) + '</small>'; }
    if (p.kind === 'camera') { const c = byId('cameras', p.id); if (!c) return ''; const v = c.views[0]; return (v.small ? '<img class="rb-thumb" src="' + esc(v.small) + '" alt="" width="240" height="135" referrerpolicy="no-referrer">' : '') + '<b>' + esc(c.location || 'Traffic camera') + '</b><small>' + esc(c.views.map(x => x.direction).filter(Boolean).join(', ') || 'Live picture') + ' · ' + esc(away(m(c))) + '</small><small>Click for the live picture</small>'; }
    if (p.kind === 'alpr') { const a = byId('alpr', p.id); if (!a) return ''; return '<span class="rb-chip" data-k="alpr">License plate reader</span><b>' + esc([a.manufacturer, a.operator].filter(Boolean).join(' · ') || 'Operator not recorded') + '</b><small>' + esc(facing(a.direction)) + (a.zone ? ' · ' + esc(a.zone) : '') + '</small><small>' + esc(away(m(a))) + '</small>'; }
    return '';
  }
  function wedge(a) {
    if (a.direction === null) return { type: 'FeatureCollection', features: [] };
    const R = 130, span = 56, pts = [[a.lng, a.lat]], cos = Math.cos(a.lat * Math.PI / 180);
    for (let k = 0; k <= 8; k++) { const b = (a.direction - span / 2 + span * k / 8) * Math.PI / 180; pts.push([a.lng + R * Math.sin(b) / (111320 * cos), a.lat + R * Math.cos(b) / 111320]); }
    pts.push([a.lng, a.lat]);
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pts] } }] };
  }
  function ensureHoverLayer(m) {
    if (m.getSource(HOVER)) return;
    m.addSource(HOVER, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    m.addLayer({ id: 'orient-civic-hover-fill', type: 'fill', source: HOVER, paint: { 'fill-color': '#7a3b8f', 'fill-opacity': 0.28 } });
    m.addLayer({ id: 'orient-civic-hover-edge', type: 'line', source: HOVER, paint: { 'line-color': '#7a3b8f', 'line-width': 1.5, 'line-opacity': 0.8 } });
  }
  function showHover(m, f, pt) {
    const html = hoverHTML(f); if (!html) { hideHover(m); return; }
    const world = document.querySelector('.world'); if (!world) return;
    if (!hoverEl) { hoverEl = document.createElement('div'); hoverEl.className = 'civic-hover'; hoverEl.setAttribute('role', 'tooltip'); world.append(hoverEl); }
    hoverEl.innerHTML = html; hoverEl.hidden = false;
    const w = world.getBoundingClientRect(), x = Math.min(pt.x + 16, w.width - hoverEl.offsetWidth - 8), y = Math.min(pt.y + 16, w.height - hoverEl.offsetHeight - 8);
    hoverEl.style.left = Math.max(8, x) + 'px'; hoverEl.style.top = Math.max(8, y) + 'px';
    if (f.properties.kind === 'alpr' && !f.properties.cluster) { const a = byId('alpr', f.properties.id); ensureHoverLayer(m); m.getSource(HOVER).setData(a ? wedge(a) : { type: 'FeatureCollection', features: [] }); }
    else if (m.getSource(HOVER)) m.getSource(HOVER).setData({ type: 'FeatureCollection', features: [] });
  }
  function hideHover(m) { if (hoverEl) hoverEl.hidden = true; if (m && m.getSource(HOVER)) m.getSource(HOVER).setData({ type: 'FeatureCollection', features: [] }); }
  function hitAt(m, point) { const layers = HIT.filter(id => m.getLayer(id) && m.getLayoutProperty(id, 'visibility') !== 'none'); return layers.length ? m.queryRenderedFeatures(point, { layers })[0] : null; }
  function bind(m) {
    if (bound === m) return; bound = m;
    const canHover = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (canHover) {
      m.on('mousemove', e => { const f = hitAt(m, e.point); if (!f) { m.getCanvas().style.cursor = ''; hideHover(m); return; } m.getCanvas().style.cursor = 'pointer'; showHover(m, f, e.point); });
      m.getCanvas().addEventListener('mouseleave', () => hideHover(m));
      m.on('movestart', () => hideHover(m));
    }
    m.on('click', async e => {
      const f = hitAt(m, e.point); if (!f || !OWN_CLICK.includes(f.layer.id)) return;
      const p = f.properties; hideHover(m);
      if (p.cluster_id !== undefined && p.cluster_id !== null) { const name = f.layer.id.includes('camera') ? 'cameras' : 'alpr'; try { const z = await m.getSource(SRC[name]).getClusterExpansionZoom(p.cluster_id); m.easeTo({ center: f.geometry.coordinates, zoom: Math.min((z || 12) + 0.4, 17) }); } catch { m.easeTo({ center: f.geometry.coordinates, zoom: m.getZoom() + 2 }); } return; }
      if (p.kind === 'camera') openCamera(p.id); else if (p.kind === 'incident') openDetail('incidents', p.id); else if (p.kind === 'alpr') openDetail('alpr', p.id);
    });
  }

  // ----- dialogs -----
  function shell() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog'); dialog.id = 'board-dialog'; dialog.setAttribute('aria-labelledby', 'board-dialog-title');
    dialog.innerHTML = '<div class="panel-heading"><div><span class="ui-kicker" data-cd-kicker></span><h2 id="board-dialog-title" data-cd-title></h2></div><button type="button" class="icon-button" data-board="close" aria-label="Close"><i data-lucide="x"></i></button></div><div data-cd-body></div>';
    document.body.append(dialog); dialog.addEventListener('close', () => { clearTimeout(camTimer); const img = dialog.querySelector('.rb-live'); if (img) img.removeAttribute('src'); });
    return dialog;
  }
  function frame(kicker, title) { const d = shell(); d.querySelector('[data-cd-kicker]').textContent = kicker; d.querySelector('[data-cd-title]').textContent = title; if (!d.open) d.showModal(); return d.querySelector('[data-cd-body]'); }
  const fact = (k, v) => v ? '<div class="rb-fact"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>' : '';
  const dateText = s => s ? new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  function openDetail(name, id) {
    const it = byId(name, id); if (!it) return; const o = origin(), d = o ? dist(o, [it.lng, it.lat]) : NaN;
    if (name === 'incidents') {
      const body = frame('Incident', [it.route, it.direction && it.direction.charAt(0).toUpperCase() + it.direction.slice(1)].filter(Boolean).join(' · ') || it.location || 'Incident');
      body.innerHTML = '<p><span class="rb-chip" data-k="' + it.status + '">' + esc(it.category || 'Incident') + ' · ' + STATUS_WORD[it.status] + '</span></p><p>' + esc(it.description || 'No description.') + '</p><div class="rb-facts">' + fact('Where', it.location) + fact('Distance', away(d)) + fact('Source', (data.incidents.source.publisher || 'State traffic agency') + (data.incidents.updated ? ', updated ' + dateText(data.incidents.updated) : '')) + '</div><div class="rb-actions"><button type="button" class="button primary" data-board="show" data-name="incidents" data-id="' + esc(id) + '">Show on map</button></div><p class="fine">For awareness, not navigation. Conditions change quickly: trust signs and the agency’s own map when you drive.</p>';
    } else {
      const body = frame('License plate reader', [it.manufacturer, it.operator].filter(Boolean).join(' · ') || 'Plate reader');
      body.innerHTML = '<p>Automated license plate readers photograph the plates of passing vehicles and can keep a searchable record of where cars have been. This one was mapped by a volunteer on OpenStreetMap.</p><div class="rb-facts">' + fact('Operator', it.operator || 'Not recorded') + fact('Make', it.manufacturer || 'Not recorded') + fact('Faces', it.direction === null ? 'Not recorded' : COMPASS[Math.round(it.direction / 45) % 8] + ' (' + it.direction + '°)') + fact('Watches', it.zone) + fact('Mounted', it.mount) + fact('Distance', away(d)) + '</div><div class="rb-actions"><button type="button" class="button primary" data-board="show" data-name="alpr" data-id="' + esc(id) + '">Show on map</button><a class="button" href="https://www.openstreetmap.org/' + esc(it.id.replace('osm:', '')) + '" target="_blank" rel="noopener">View on OpenStreetMap</a><a class="button" href="https://deflock.org/" target="_blank" rel="noopener">About DeFlock</a></div><p class="fine">Mapped by volunteers, so it can be incomplete or out of date. Map data © OpenStreetMap contributors (ODbL). To add or correct a reader, use DeFlock or OpenStreetMap.</p>';
    }
    paint();
  }
  function openCamera(id, viewIndex = 0) {
    const c = byId('cameras', id); if (!c) return; const v = c.views[Math.min(viewIndex, c.views.length - 1)];
    const body = frame('Traffic camera', c.location || 'Traffic camera'); clearTimeout(camTimer);
    body.innerHTML = (c.views.length > 1 ? '<div class="ui-chips rb-views" role="group" aria-label="Camera views">' + c.views.map((x, k) => '<button type="button" class="ui-chip" data-board="view" data-id="' + esc(id) + '" data-view="' + k + '" aria-pressed="' + (k === viewIndex) + '">' + esc(x.direction || 'View ' + (k + 1)) + '</button>').join('') + '</div>' : '') +
      '<div class="rb-shot"><img class="rb-live" alt="Live picture from the traffic camera at ' + esc(c.location) + '" referrerpolicy="no-referrer"><p class="rb-shot-note" role="status">Loading the picture…</p></div><div class="rb-facts">' + fact('Looking', v.direction) + fact('Watching', v.route) + fact('About', c.description) + '</div><div class="rb-actions"><button type="button" class="button" data-board="show" data-name="cameras" data-id="' + esc(id) + '">Show on map</button></div><p class="fine">The picture comes straight from ' + esc((data.cameras.source.publisher || 'the state traffic agency')) + ' and refreshes every few seconds while this is open. Orient does not store it.</p>';
    const img = body.querySelector('.rb-live'), note = body.querySelector('.rb-shot-note'), url = v.large || v.small; let failed = 0;
    const next = () => { clearTimeout(camTimer); camTimer = setTimeout(go, 6000); };
    const go = () => { if (!dialog || !dialog.open) return; img.src = url + (failed ? '' : (url.includes('?') ? '&' : '?') + '_=' + Date.now()); };
    img.onload = () => { failed = 0; note.hidden = true; next(); };
    img.onerror = () => { failed++; if (failed < 3) { go(); return; } note.hidden = false; note.textContent = 'This camera’s picture isn’t available right now.'; };
    go(); paint();
  }
  function show(name, id) {
    const m = map(); let pts = [];
    if (name === 'roadwork') { dialog && dialog.open && dialog.close(); return window.OrientRoadwork && OrientRoadwork.show(id); }
    const it = byId(name, id); if (!it || !m) return; dialog && dialog.open && dialog.close();
    pts = [[it.lng, it.lat], ...(it.polyline || [])];
    const xs = pts.map(c => c[0]), ys = pts.map(c => c[1]);
    if (pts.length > 1) m.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 90, maxZoom: 15.5, duration: 600 }); else m.easeTo({ center: pts[0], zoom: Math.max(m.getZoom(), 15), duration: 600 });
  }

  // ----- the Closures view: a filter, like Specials or Open now, that shows closures and nothing else -----
  const canClose = () => !!(window.OrientRoadwork && OrientRoadwork.source && OrientRoadwork.source());
  const chip = () => '<button type="button" class="rb-chip-btn" data-closures aria-pressed="' + closuresView + '"><i data-lucide="construction" aria-hidden="true"></i>Closures</button>';
  const closuresChip = () => canClose() && tab() === 'Explore' ? chip() : '';
  async function setClosuresView(on) {
    closuresView = !!on; const world = document.querySelector('.world'); if (world) world.dataset.view = closuresView ? 'closures' : '';
    if (window.OrientRoadwork) await OrientRoadwork.setClosuresView(closuresView);
    ensure(); drawAll(); if (api.render) api.render();
    if (closuresView && window.OrientRoadwork) OrientRoadwork.open();
  }

  // ----- the Civic tab -----
  const near = (list, km) => { const o = origin(); return o ? list.map(i => ({ ...i, meters: dist(o, [i.lng, i.lat]) })).filter(i => i.meters <= km * 1000).sort((a, b) => a.meters - b.meters) : []; };
  const ago = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return !iso ? 'at an unknown time' : m < 2 ? 'just now' : m < 90 ? m + ' minutes ago' : m < 2880 ? Math.round(m / 60) + ' hours ago' : Math.round(m / 1440) + ' days ago'; };
  const switchFor = (name, label) => { const explicit = name === 'roadwork' ? true : prefs()[name] !== null; return '<label class="rb-switch"><span>' + (explicit ? 'On the map' : 'Here only') + '</span><input type="checkbox" data-board-layer="' + name + '" aria-label="' + esc(label) + ' on the map"' + ((name === 'roadwork' ? roadworkOn() : layerOn(name)) ? ' checked' : '') + '></label>' + (explicit ? '' : '<button type="button" class="rb-pin" data-board="pin" data-layer="' + name + '" aria-label="Keep ' + esc(label) + ' on the map on the other tabs too" title="Keep on the other tabs too"><i data-lucide="pin" aria-hidden="true"></i></button>'); };
  const head = (icon, title, count, name, tone) => '<header class="rb-head"><span class="rb-ico" data-tone="' + tone + '">' + '<i data-lucide="' + icon + '" aria-hidden="true"></i></span><h3>' + esc(title) + (count !== null ? ' <span class="tag">' + count + '</span>' : '') + '</h3>' + (name ? switchFor(name, title) : '') + '</header>';
  const none = text => '<p class="rb-none">' + esc(text) + '</p>';
  function weatherSection() {
    const w = window.OrientWeather && OrientWeather.brief ? OrientWeather.brief() : null;
    if (!w) return '<section class="rb-card" id="rb-weather">' + head('cloud-sun', 'Weather and alerts', null, null, 'sky') + none('Weather is switched off. You can turn it on in your field kit.') + '</section>';
    return '<section class="rb-card" id="rb-weather">' + head('cloud-sun', 'Weather and alerts', w.alerts.length || null, null, w.alerts.length ? 'warn' : 'sky') + '<button type="button" class="rb-row" data-board="weather"><i data-lucide="' + w.icon + '" aria-hidden="true"></i><span><b>' + esc(w.temp) + ' · ' + esc(w.label) + '</b><small>' + esc(w.detail) + '</small></span><span aria-hidden="true">›</span></button>' +
      (w.alerts.length ? w.alerts.slice(0, 3).map(a => '<button type="button" class="rb-row rb-alert" data-sev="' + esc(a.severity) + '" data-board="weather"><i data-lucide="triangle-alert" aria-hidden="true"></i><span><b>' + esc(a.event) + '</b><small>' + esc(clip(a.headline || a.area || '', 120)) + '</small></span><span aria-hidden="true">›</span></button>').join('') : none('No weather alerts for this area.')) + '</section>';
  }
  function roadworkSection() {
    const r = window.OrientRoadwork; if (!r || !r.source()) return '';
    const s = r.summary(), list = r.list(30).filter(i => !i.upcoming && (i.status === 'closed' || i.status === 'restricted')).slice(0, 4);
    return '<section class="rb-card" id="rb-roadwork">' + head('construction', 'Road work and closures', s.loaded ? s.counts.closed + s.counts.restricted || null : null, 'roadwork', s.counts.closed ? 'bad' : 'work') +
      (!r.shown() ? none('Road work is switched off. Turn it on to see closures here and on the map.') : !s.loaded ? none('Loading road work…') : list.length ? list.map(i => '<div class="rb-row"><i data-lucide="' + (i.status === 'closed' ? 'octagon-x' : 'construction') + '" aria-hidden="true" data-k="' + i.status + '"></i><span><b>' + esc(i.title) + '</b><small>' + esc([i.description && clip(i.description, 90), i.when, away(i.meters)].filter(Boolean).join(' · ')) + '</small></span><button type="button" class="button" data-board="show" data-name="roadwork" data-id="' + esc(i.id) + '">Show</button></div>').join('') + '<button type="button" class="button full" data-board="roadwork">See all closures and construction</button>' : none('No closures or lane restrictions within about 20 miles.')) + '</section>';
  }
  function incidentsSection() {
    const d = data.incidents; if (!base()) return '';
    const list = d ? near(d.items, 40).slice(0, 5) : [];
    return '<section class="rb-card" id="rb-incidents">' + head('siren', 'Incidents', d ? near(d.items, 40).length || null : null, 'incidents', list.some(i => i.status === 'closed') ? 'bad' : 'work') +
      (d === undefined || (d === null && loading.incidents) ? none('Loading incidents…') : !d ? none('Incidents aren’t available right now.') : list.length ? list.map(i => '<div class="rb-row"><i data-lucide="triangle-alert" aria-hidden="true" data-k="' + i.status + '"></i><span><b>' + esc([i.route, i.direction && i.direction.charAt(0).toUpperCase() + i.direction.slice(1)].filter(Boolean).join(' · ') || i.location || 'Incident') + ' <span class="rb-chip" data-k="' + i.status + '">' + esc(i.category || STATUS_WORD[i.status]) + '</span></b><small>' + esc([clip(i.description || i.location, 100), away(i.meters)].filter(Boolean).join(' · ')) + '</small></span><button type="button" class="button" data-board="detail" data-name="incidents" data-id="' + esc(i.id) + '">Details</button></div>').join('') : none('No incidents reported within about 25 miles. That’s a good sign.')) +
      (d ? '<p class="fine">From ' + esc(d.source.publisher || 'the state traffic agency') + ', updated ' + esc(ago(d.updated)) + '.</p>' : '') + '</section>';
  }
  function camerasSection() {
    const d = data.cameras; if (!base()) return '';
    const list = d ? near(d.items, 24).slice(0, 4) : [];
    return '<section class="rb-card" id="rb-cameras">' + head('cctv', 'Traffic cameras', d ? d.items.length : null, 'cameras', 'cam') +
      (d === undefined || (d === null && loading.cameras) ? none('Loading cameras…') : !d ? none('Cameras aren’t available right now.') : list.length ? '<div class="rb-cams">' + list.map(c => '<button type="button" class="rb-cam" data-board="camera" data-id="' + esc(c.id) + '"><span class="rb-cam-img">' + (c.views[0].small ? '<img loading="lazy" src="' + esc(c.views[0].small) + '" alt="" referrerpolicy="no-referrer">' : '') + '</span><b>' + esc(c.location || 'Traffic camera') + '</b><small>' + esc(away(c.meters)) + '</small></button>').join('') + '</div>' : none('No state traffic cameras within about 15 miles.')) +
      (d ? '<p class="fine">Live pictures load straight from ' + esc(d.source.publisher || 'the state') + ' when you open a camera.</p>' : '') + '</section>';
  }
  function alprSection() {
    const d = data.alpr; if (!base()) return '';
    const all = d ? near(d.items, 8) : [], by = key => [...all.reduce((m, a) => m.set(a[key] || 'Not recorded', (m.get(a[key] || 'Not recorded') || 0) + 1), new Map())].sort((x, y) => y[1] - x[1]);
    const ops = by('operator'), makes = by('manufacturer');
    return '<section class="rb-card" id="rb-alpr">' + head('scan-eye', 'License plate readers', d ? d.items.length : null, 'alpr', 'alpr') +
      (d === undefined || (d === null && loading.alpr) ? none('Loading plate readers…') : !d ? none('Plate readers aren’t available right now.') : '<p class="rb-lede"><b>' + all.length + '</b> mapped within about 5 miles of ' + esc(api.label ? api.label() || 'here' : 'here') + (all.length ? ', run by <b>' + ops.length + '</b> ' + (ops.length === 1 ? 'operator' : 'operators') + '.' : '.') + '</p>' +
        (all.length ? '<div class="rb-bars" role="list" aria-label="Plate readers within five miles, by operator">' + ops.slice(0, 5).map(([name, n]) => '<div class="rb-bar" role="listitem"><span>' + esc(name) + '</span><i style="width:' + Math.max(6, Math.round(n / ops[0][1] * 100)) + '%"></i><b>' + n + '</b></div>').join('') + '</div>' + (makes.length ? '<p class="fine">Makes: ' + makes.slice(0, 4).map(([k, n]) => esc(k) + ' (' + n + ')').join(', ') + '.</p>' : '') : '') +
        all.slice(0, 3).map(a => '<div class="rb-row"><i data-lucide="scan-eye" aria-hidden="true" data-k="alpr"></i><span><b>' + esc([a.manufacturer, a.operator].filter(Boolean).join(' · ') || 'Plate reader') + '</b><small>' + esc([facing(a.direction), away(a.meters)].join(' · ')) + '</small></span><button type="button" class="button" data-board="detail" data-name="alpr" data-id="' + esc(a.id) + '">Details</button></div>').join('') +
        '<details class="ui-more rb-about"><summary><i data-lucide="info" aria-hidden="true"></i>What are these?</summary><div><p class="fine">Automated license plate readers are cameras that photograph the plates of passing vehicles and can keep a searchable record of where cars have been. Volunteers map where they are on OpenStreetMap, and <a href="https://deflock.org/" target="_blank" rel="noopener">DeFlock</a> collects that map. The arrow shows which way a reader faces.</p><p class="fine">The map is mostly what people have spotted, so it can be incomplete or out of date. Map data © OpenStreetMap contributors, under the <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">Open Database License</a>. To add or correct one, use DeFlock or OpenStreetMap.</p></div></details>' +
        '<p class="fine">' + esc(d.source.dataAsOf ? 'OpenStreetMap data as of ' + dateText(d.source.dataAsOf) + '.' : 'Updated ' + ago(d.updated) + '.') + '</p>') + '</section>';
  }
  // air quality, fuel context and park amenities: the "Useful nearby" content, drawn by civic.js into this card
  const usefulSection = () => '<section class="rb-card" id="rb-useful">' + head('leaf', 'Useful nearby', null, null, 'sky') + '<div data-civic-host></div></section>';
  const mountUseful = panel => { const el = panel.querySelector('[data-civic-host]'); if (el && window.OrientCivic && OrientCivic.mount) OrientCivic.mount(el); };
  function tiles() {
    const w = window.OrientWeather && OrientWeather.brief ? OrientWeather.brief() : null, rw = window.OrientRoadwork ? OrientRoadwork.summary() : null;
    const inc = data.incidents ? near(data.incidents.items, 40).length : null, al = data.alpr ? near(data.alpr.items, 8).length : null, cam = data.cameras ? data.cameras.items.length : null;
    const t = (cls, n, label, target) => '<button type="button" class="ui-tile ' + cls + '" data-board="jump" data-target="' + target + '"><b>' + n + '</b><span>' + esc(label) + '</span></button>';
    return '<div class="rb-tiles">' + t('teal', w ? w.temp : '–', !w ? 'weather switched off' : w.alerts.length ? w.alerts.length + (w.alerts.length === 1 ? ' weather alert' : ' weather alerts') : 'weather, no alerts', 'rb-weather') + t('orange', rw && rw.loaded ? rw.counts.closed : '–', 'roads closed nearby', 'rb-roadwork') + t('gold', inc === null ? '–' : inc, inc === 1 ? 'incident nearby' : 'incidents nearby', 'rb-incidents') + t('plum', al === null ? '–' : al, 'plate readers within 5 mi', 'rb-alpr') + '</div>' + (cam !== null ? '<p class="rb-sub">' + cam + ' state traffic cameras in the region</p>' : '');
  }
  const SECTIONS = {overview:'Overview',conditions:'Conditions',cameras:'Cameras',amenities:'Amenities'};
  const selectedSection = () => { const v = jget('orient-civic-section', 'overview'); return SECTIONS[v] ? v : 'overview'; };
  function chooseSection(name, focus = false) {
    if (!SECTIONS[name]) return;
    jset('orient-civic-section', name);
    if (api.render) api.render();
    const panel = document.getElementById('panel'); if (panel) panel.scrollTop = 0;
    if (focus) document.getElementById('civic-tab-' + name)?.focus();
  }
  function render(panel) {
    ensure();
    const place = api.label ? api.label() : '', current = selectedSection();
    const nav = '<div class="civic-tabs" role="tablist" aria-label="Civic sections">' + Object.entries(SECTIONS).map(([id,label]) => '<button type="button" role="tab" id="civic-tab-' + id + '" aria-controls="civic-content" aria-selected="' + (current === id) + '" tabindex="' + (current === id ? '0' : '-1') + '" data-board="section" data-section="' + id + '">' + label + '</button>').join('') + '</div>';
    let content = '';
    if (current === 'overview') content = tiles() + weatherSection() + usefulSection() + '<div class="civic-shortcuts"><button class="button full" data-board="section" data-section="conditions">Road conditions →</button><button class="button full" data-board="section" data-section="cameras">Cameras & plate readers →</button><button class="button full" data-board="section" data-section="amenities">Find amenities & Wi-Fi →</button></div>';
    else if (current === 'conditions') content = base() ? roadworkSection() + incidentsSection() : none('No road conditions feed for this area yet.');
    else if (current === 'cameras') content = base() ? camerasSection() + alprSection() : none('No camera feed for this area yet.');
    else content = OrientWifi.board() + usefulSection();
    panel.classList.remove('briefing-drawer', 'briefing-expanded'); panel.hidden = false; panel.dataset.civic = '1';
    panel.innerHTML = '<div class="explore-list-heading"><div class="kicker">The city right now</div></div><h2>' + esc(place ? place + ' today' : 'Civic') + '</h2>' + nav + '<div id="civic-content" role="tabpanel" aria-labelledby="civic-tab-' + current + '" data-civic-section="' + current + '">' + content + '</div>';
    paint(); mountUseful(panel);
  }

  function onClick(e) {
    if (e.target.closest('[data-closures]')) { setClosuresView(!closuresView); return; }
    // choosing another Explore filter ends the closures view
    if (closuresView && e.target.closest('[data-filter]')) { closuresView = false; const w = document.querySelector('.world'); if (w) w.dataset.view = ''; if (window.OrientRoadwork) OrientRoadwork.setClosuresView(false); ensure(); drawAll(); }
    const b = e.target.closest('[data-board]'); if (!b) return; const a = b.dataset.board;
    if (a === 'section') chooseSection(b.dataset.section);
    else if (a === 'close') { dialog && dialog.close(); }
    else if (a === 'weather') window.OrientWeather && OrientWeather.open();
    else if (a === 'roadwork') window.OrientRoadwork && OrientRoadwork.open();
    else if (a === 'show') show(b.dataset.name, b.dataset.id);
    else if (a === 'pin') { const p = prefs(); p[b.dataset.layer] = true; jset(PREF, p); ensure(); drawAll(); if (api.render) api.render(); }
    else if (a === 'detail') openDetail(b.dataset.name, b.dataset.id);
    else if (a === 'camera') openCamera(b.dataset.id);
    else if (a === 'view') openCamera(b.dataset.id, +b.dataset.view);
    else if (a === 'jump') { const target = b.dataset.target; if (target === 'rb-weather') window.OrientWeather && OrientWeather.open(); else chooseSection(target === 'rb-alpr' ? 'cameras' : 'conditions'); }
  }
  function onChange(e) {
    const box = e.target.closest('[data-board-layer]'); if (!box) return; const name = box.dataset.boardLayer;
    if (name === 'roadwork') { OrientRoadwork.setShown(box.checked); return; }
    const p = prefs(); p[name] = box.checked; jset(PREF, p); ensure(); drawAll(); if (api.render) api.render();
  }

  function init(a) {
    document.addEventListener('keydown', e => {
      const t = e.target.closest('[role="tab"][data-section]'); if (!t) return;
      const keys = Object.keys(SECTIONS), n = keys.indexOf(t.dataset.section);
      let next; if (e.key === 'ArrowRight') next = keys[(n + 1) % keys.length]; else if (e.key === 'ArrowLeft') next = keys[(n + keys.length - 1) % keys.length]; else if (e.key === 'Home') next = keys[0]; else if (e.key === 'End') next = keys.at(-1); else return;
      e.preventDefault(); chooseSection(next, true);
    });
    api = a; document.addEventListener('orient-weather', changed); document.addEventListener('orient-roadwork', changed); document.addEventListener('click', onClick); document.addEventListener('change', onChange);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { for (const n of Object.keys(FILES)) if (data[n] && Date.now() - (jget(CACHE, {})[n] || { at: 0 }).at > TTL[n]) load(n, true); } });
    ensure(); drawAll();
  }
  // called after every app render: it knows the current tab, so layers that are "only on the Civic tab" appear and disappear with it
  function sync() { if (!api) return; if (closuresView && tab() !== 'Explore') setClosuresView(false); ensure(); drawAll(); if (tab() !== 'Civic') { const p = document.getElementById('panel'); if (p && p.dataset.civic) delete p.dataset.civic; } }
  return { init, render, sync, validate, closuresChip, setClosuresView, closuresView: () => closuresView, state: () => ({ loaded: Object.keys(data).filter(k => data[k]), layers: Object.fromEntries(Object.keys(FILES).map(k => [k, layerOn(k)])) }),
    mapLayers: () => { const m = map(); if (!m) return null; return Object.fromEntries(Object.keys(FILES).map(k => [k, m.getSource(SRC[k]) ? { visible: LAYER_IDS[k].some(id => m.getLayer(id) && m.getLayoutProperty(id, 'visibility') !== 'none'), features: m.getSource(SRC[k]).serialize().data.features.length } : null])); },
    hoverCount: () => { const m = map(), s = m && m.getSource(HOVER); return s ? s.serialize().data.features.length : 0; }, firstCluster: name => { const m = map(); if (!m) return null; const f = m.queryRenderedFeatures({ layers: ['orient-' + name + '-cluster'] })[0]; if (!f) return null; const p = m.project(f.geometry.coordinates), r = m.getCanvas().getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y, count: f.properties.point_count }; }, flyTo: (lng, lat, zoom) => { const m = map(); if (m) m.jumpTo({ center: [lng, lat], zoom }); }, project: (lng, lat) => { const m = map(); if (!m) return null; const p = m.project([lng, lat]), r = m.getCanvas().getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; }, openCamera, openDetail };
})();
