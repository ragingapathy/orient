'use strict';
// Turns a Work Zone Data Exchange (WZDx) feed into the small, plain road-work file Orient reads.
// WZDx is the US national standard for road work: https://github.com/usdot-jpo-ode/wzdx
// Each state that publishes a feed (Ohio's OHGO, Michigan's, and others) can be read with this one function.
// It is forgiving about the version (3.x to 4.x) and about key spelling (snake_case or PascalCase), and strict about its output.

const norm = k => String(k).toLowerCase().replace(/_/g, '');
// look a field up whatever its spelling: core_details, coreDetails, CoreDetails
const get = (obj, ...names) => {
  if (!obj || typeof obj !== 'object') return undefined;
  const want = names.map(norm);
  for (const k of Object.keys(obj)) if (want.includes(norm(k))) return obj[k];
  return undefined;
};
const text = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const round = v => Math.round(v * 1e5) / 1e5;
const validPoint = c => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 85;
const when = v => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return Number.isFinite(t) ? new Date(t).toISOString() : ''; };

// all-lanes-closed is a closure; anything that takes a lane or makes traffic share one is a restriction
function statusOf(impact) {
  const v = String(impact || '').toLowerCase();
  if (v === 'all-lanes-closed') return 'closed';
  if (v === 'all-lanes-open') return 'open';
  if (!v || v === 'unknown') return 'unknown';
  return 'restricted';
}

function thin(line, max = 40) {
  if (line.length <= max) return line;
  const out = [], step = (line.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(line[Math.round(i * step)]);
  return out;
}

function inBox(line, bbox) { return !bbox || line.some(([x, y]) => x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3]); }

/**
 * @param feed   a parsed WZDx GeoJSON FeatureCollection
 * @param opts   { source: 'ohgo', bbox: [west, south, east, north], now: Date, graceDays: 1, aheadDays: 14, max: 600 }
 * @returns      { items, skipped }  items are plain objects; skipped counts what was left out and why
 */
function normalize(feed, opts = {}) {
  const { source = 'feed', bbox = null, now = new Date(), graceDays = 1, aheadDays = 14, max = 600 } = opts;
  const features = feed && Array.isArray(feed.features) ? feed.features : [];
  const skipped = { badGeometry: 0, outsideArea: 0, over: 0, tooFar: 0, notRoadWork: 0 };
  const items = [];
  features.forEach((f, i) => {
    if (!f || typeof f !== 'object') { skipped.badGeometry++; return; }
    const props = get(f, 'properties') || {}, core = get(props, 'core_details') || props; // WZDx 3.x kept these directly on properties
    const type = String(get(core, 'event_type') || 'work-zone').toLowerCase();
    if (!['work-zone', 'detour', 'restriction'].includes(type)) { skipped.notRoadWork++; return; }
    const g = get(f, 'geometry'), kind = g && get(g, 'type'), coords = g && get(g, 'coordinates');
    let line = [];
    if (kind === 'LineString' && Array.isArray(coords)) line = coords.filter(validPoint).map(c => [round(c[0]), round(c[1])]);
    else if (kind === 'MultiPoint' && Array.isArray(coords)) line = coords.filter(validPoint).map(c => [round(c[0]), round(c[1])]);
    else if (kind === 'Point' && validPoint(coords)) line = [[round(coords[0]), round(coords[1])]];
    if (!line.length) { skipped.badGeometry++; return; }
    if (!inBox(line, bbox)) { skipped.outsideArea++; return; }

    const start = when(get(props, 'start_date') || get(core, 'start_date')), end = when(get(props, 'end_date') || get(core, 'end_date'));
    if (end && Date.parse(end) < now.getTime() - graceDays * 864e5) { skipped.over++; return; }
    if (start && Date.parse(start) > now.getTime() + aheadDays * 864e5) { skipped.tooFar++; return; }
    const impact = text(String(get(props, 'vehicle_impact') || get(core, 'vehicle_impact') || ''), 40).toLowerCase();
    const roads = (Array.isArray(get(core, 'road_names')) ? get(core, 'road_names') : []).map(r => text(r, 40)).filter(Boolean).slice(0, 4);
    const id = text(String(get(f, 'id') ?? get(core, 'road_event_id') ?? ''), 80) || source + '-' + i;
    items.push({
      id: source + ':' + id, source,
      roads, direction: text(get(core, 'direction'), 24).toLowerCase(),
      status: statusOf(impact), impact,
      description: text(get(core, 'description'), 260),
      from: text(get(props, 'beginning_cross_street') || get(core, 'beginning_cross_street'), 80), to: text(get(props, 'ending_cross_street') || get(core, 'ending_cross_street'), 80),
      start, end, upcoming: !!start && Date.parse(start) > now.getTime(),
      updated: when(get(core, 'update_date')),
      geometry: thin(line),
    });
  });
  const rank = { closed: 0, restricted: 1, unknown: 2, open: 3 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || a.id.localeCompare(b.id));
  if (items.length > max) { skipped.over += items.length - max; items.length = max; }
  return { items, skipped };
}

module.exports = { normalize, statusOf, thin };
