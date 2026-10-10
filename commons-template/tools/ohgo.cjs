'use strict';
// Ohio's OHGO Public API (https://publicapi.ohgo.com/docs/resources): traffic cameras and incidents, reduced to small plain files.
// The work-zone feed is read separately, as WZDx (wzdx.cjs). A key is required; it comes from the environment, never from a file.
// Records are checked and trimmed here so the file Orient downloads is small and contains only what the app shows.

const get = (obj, ...names) => {
  if (!obj || typeof obj !== 'object') return undefined;
  const want = names.map(n => n.toLowerCase().replace(/_/g, ''));
  for (const k of Object.keys(obj)) if (want.includes(k.toLowerCase().replace(/_/g, ''))) return obj[k];
  return undefined;
};
const text = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const round = v => Math.round(v * 1e5) / 1e5;
const point = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 85 && Math.abs(lng) <= 180;
const httpsUrl = v => { try { const u = new URL(String(v)); return u.protocol === 'https:' && String(v).length <= 400 ? u.toString() : ''; } catch { return ''; } };
const inBox = (lat, lng, bbox) => !bbox || (lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]);

async function fetchResource({ base = 'https://publicapi.ohgo.com', resource, key, bbox, fetchImpl = fetch }) {
  if (!key) return { skipped: 'no key set' };
  const u = new URL(base + '/api/v1/' + resource);
  if (bbox) { u.searchParams.set('map-bounds-sw', bbox[1] + ',' + bbox[0]); u.searchParams.set('map-bounds-ne', bbox[3] + ',' + bbox[2]); }
  u.searchParams.set('page-all', 'true');
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetchImpl(u.toString(), { headers: { Accept: 'application/json', Authorization: 'APIKEY ' + key, 'User-Agent': 'orient-commons-civic (+https://github.com/ragingapathy/orient)' }, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const json = await r.json();
    const results = get(json, 'results', 'items', 'data');
    return { results: Array.isArray(results) ? results : Array.isArray(json) ? json : [] };
  } finally { clearTimeout(timer); }
}

function normalizeCameras(results, { bbox = null, max = 800 } = {}) {
  const items = [];
  for (const c of Array.isArray(results) ? results : []) {
    const lat = Number(get(c, 'latitude')), lng = Number(get(c, 'longitude'));
    if (!point(lat, lng) || !inBox(lat, lng, bbox)) continue;
    const views = (Array.isArray(get(c, 'camera_views', 'cameraviews')) ? get(c, 'camera_views', 'cameraviews') : []).map(v => ({
      direction: text(get(v, 'direction'), 24), route: text(get(v, 'main_route', 'mainroute'), 80), small: httpsUrl(get(v, 'small_url', 'smallurl')), large: httpsUrl(get(v, 'large_url', 'largeurl')),
    })).filter(v => v.small || v.large).slice(0, 6);
    if (!views.length) continue;
    items.push({ id: 'ohgo:' + (text(String(get(c, 'id') ?? ''), 60) || items.length), lat: round(lat), lng: round(lng), location: text(get(c, 'location'), 120), description: text(get(c, 'description'), 160), views });
    if (items.length >= max) break;
  }
  return items;
}

// A road closure or hazard reported by ODOT: accidents, weather, flooding, closures.
function normalizeIncidents(results, { bbox = null, max = 400 } = {}) {
  const items = [];
  for (const i of Array.isArray(results) ? results : []) {
    const lat = Number(get(i, 'latitude')), lng = Number(get(i, 'longitude'));
    if (!point(lat, lng) || !inBox(lat, lng, bbox)) continue;
    const status = String(get(i, 'road_status', 'roadstatus') || '').toLowerCase();
    const closure = get(i, 'road_closure_details', 'roadclosuredetails');
    const line = (Array.isArray(get(closure, 'polyline')) ? get(closure, 'polyline') : []).filter(c => Array.isArray(c) && point(c[1], c[0])).map(c => [round(c[0]), round(c[1])]);
    const step = line.length > 30 ? (line.length - 1) / 29 : 1, thin = line.length > 30 ? Array.from({ length: 30 }, (_, k) => line[Math.round(k * step)]) : line;
    items.push({
      id: 'ohgo:' + (text(String(get(i, 'id') ?? ''), 60) || items.length), lat: round(lat), lng: round(lng),
      category: text(get(i, 'category'), 40), route: text(get(i, 'route_name', 'routename'), 60), direction: text(get(i, 'direction'), 24).toLowerCase(), location: text(get(i, 'location'), 120),
      description: text(get(i, 'description'), 300), status: status.includes('closed') && !status.includes('partial') ? 'closed' : status.includes('partial') || status.includes('restrict') ? 'partial' : status.includes('open') ? 'open' : 'unknown',
      polyline: thin.length > 1 ? thin : [],
    });
    if (items.length >= max) break;
  }
  const rank = { closed: 0, partial: 1, unknown: 2, open: 3 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || a.id.localeCompare(b.id));
  return items;
}

module.exports = { fetchResource, normalizeCameras, normalizeIncidents, get };
