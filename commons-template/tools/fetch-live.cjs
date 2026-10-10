'use strict';
// Builds the civic data files Orient reads, from public sources, for one region:
//   roadwork.json   work zones and closures (WZDx, the US standard; Ohio's OHGO feed)
//   incidents.json  accidents, hazards and closures reported by the state (OHGO)
//   cameras.json    state traffic cameras: where they are and where their pictures live (OHGO)
//   alpr.json       automated license plate readers mapped by volunteers on OpenStreetMap (what DeFlock maps)
//   node tools/fetch-live.cjs [--config live.config.json] [--previous-dir previous] [--out-dir out]
// Keys come from environment variables (GitHub Actions secrets) and are never written or printed. A source that fails keeps its
// last good data for a while (stale), so one bad half hour never empties the map; the plate-reader file is only refreshed daily.

const fs = require('node:fs');
const path = require('node:path');
const { buildRoadwork } = require('./fetch-roadwork.cjs');
const ohgo = require('./ohgo.cjs');
const alpr = require('./alpr.cjs');

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const HOUR = 3600e3;
const readJSON = file => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

// one dataset: fetch(), then normalise; on failure reuse the previous file while it is young enough
async function dataset({ format, previous, now, maxStaleHours, source, run, minHours = 0 }) {
  const old = previous && previous.format === format && previous.source ? previous : null;
  if (minHours && old && old.source.status === 'ok' && Date.parse(old.source.fetched) > now.getTime() - minHours * HOUR) return { ...old, source: { ...old.source, ...source, status: 'ok', fetched: old.source.fetched, note: 'unchanged since the last daily refresh' } };
  const entry = { ...source };
  let items = null;
  try {
    const got = await run();
    if (got.skipped) { entry.status = 'skipped'; entry.note = got.skipped; }
    else { items = got.items; entry.status = 'ok'; entry.fetched = now.toISOString(); entry.count = items.length; if (got.extra) Object.assign(entry, got.extra); }
  } catch (e) { entry.status = 'failed'; entry.note = String(e && e.message || e).replace(/\s+/g, ' ').slice(0, 300); }
  if (items === null) {
    if (old && old.source.fetched && Date.parse(old.source.fetched) > now.getTime() - maxStaleHours * HOUR) { items = old.items; entry.status = 'stale'; entry.fetched = old.source.fetched; entry.count = items.length; }
    else items = [];
  }
  return { format, version: 1, updated: now.toISOString(), source: entry, items };
}

async function buildCivic({ config, previousDir = null, now = new Date(), env = process.env, fetchImpl = fetch, overpassEndpoints }) {
  const prev = name => previousDir ? readJSON(path.join(previousDir, name)) : null;
  const files = {};
  files['roadwork.json'] = await buildRoadwork({ name: config.name, bbox: config.bbox, feeds: (config.wzdx && config.wzdx.feeds) || [] }, prev('roadwork.json'), now, env);
  const o = config.ohgo;
  if (o) {
    const key = env[o.secretEnv || 'OHGO_API_KEY'], base = o.base || 'https://publicapi.ohgo.com';
    const src = { id: 'ohgo', name: 'Ohio roads (OHGO)', publisher: o.publisher || 'Ohio Department of Transportation', homepage: o.homepage || 'https://www.ohgo.com/', license: 'Public data from ODOT' };
    if (o.incidents !== false) files['incidents.json'] = await dataset({ format: 'orient-incidents', previous: prev('incidents.json'), now, maxStaleHours: 6, source: src, run: async () => { const r = await ohgo.fetchResource({ base, resource: 'incidents', key, bbox: config.bbox, fetchImpl }); return r.skipped ? r : { items: ohgo.normalizeIncidents(r.results, { bbox: config.bbox }), extra: { received: r.results.length } }; } });
    if (o.cameras !== false) files['cameras.json'] = await dataset({ format: 'orient-cameras', previous: prev('cameras.json'), now, maxStaleHours: 72, source: src, run: async () => { const r = await ohgo.fetchResource({ base, resource: 'cameras', key, bbox: config.bbox, fetchImpl }); return r.skipped ? r : { items: ohgo.normalizeCameras(r.results, { bbox: config.bbox }), extra: { received: r.results.length } }; } });
  }
  const a = config.alpr;
  if (a && a.enabled !== false) {
    const src = { id: 'osm-alpr', name: 'Plate readers mapped on OpenStreetMap', publisher: 'OpenStreetMap contributors (mapped with DeFlock)', homepage: 'https://deflock.org/', license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors' };
    files['alpr.json'] = await dataset({ format: 'orient-alpr', previous: prev('alpr.json'), now, maxStaleHours: 14 * 24, minHours: a.minHours ?? 20, source: src, run: async () => { const r = await alpr.fetchNodes(config.bbox, { endpoints: overpassEndpoints, fetchImpl, pauseMs: a.pauseMs }); return { items: alpr.normalize(r.elements), extra: r.asOf ? { dataAsOf: r.asOf } : {} }; } });
  }
  return files;
}

async function main() {
  const root = path.join(__dirname, '..');
  const config = readJSON(path.resolve(arg('config', path.join(root, 'live.config.json'))));
  if (!config) throw new Error('live.config.json is missing or not JSON');
  const outDir = path.resolve(arg('out-dir', 'out')); fs.mkdirSync(outDir, { recursive: true });
  const files = await buildCivic({ config, previousDir: fs.existsSync(arg('previous-dir', 'previous')) ? path.resolve(arg('previous-dir', 'previous')) : null });
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(outDir, name), JSON.stringify(body) + '\n');
  for (const [name, body] of Object.entries(files)) { const s = body.source || (body.sources || [])[0] || {}; console.log(name + ': ' + (body.items || []).length + ' items (' + (body.sources ? body.sources.map(x => x.id + ' ' + x.status).join(', ') : s.status) + ')'); }
}
if (require.main === module) main().catch(e => { console.error('civic fetch failed: ' + (e && e.message)); process.exit(1); });
module.exports = { buildCivic };
