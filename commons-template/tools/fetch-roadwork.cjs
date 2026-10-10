'use strict';
// Fetches the road-work feeds listed in roadwork.config.json and writes one small file, roadwork.json, that Orient reads.
//   node tools/fetch-roadwork.cjs [--config roadwork.config.json] [--previous previous.json] [--out roadwork.json]
// API keys come from environment variables (GitHub Actions secrets) and are never written anywhere or printed.
// One feed failing never empties the file: its last good data is kept for up to six hours.

const fs = require('node:fs');
const path = require('node:path');
const { normalize } = require('./wzdx.cjs');

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const KEEP_MS = 6 * 3600e3;

async function fetchFeed(feed, key) {
  const headers = { Accept: 'application/geo+json, application/json', 'User-Agent': 'orient-commons-roadwork (+https://github.com/ragingapathy/orient)' };
  let url = feed.url;
  if (feed.auth && feed.auth.secretEnv) {
    if (!key) return { skipped: 'no key set (' + feed.auth.secretEnv + ')' };
    if (feed.auth.style === 'query') { const u = new URL(url); u.searchParams.set(feed.auth.param || 'api-key', key); url = u.toString(); }
    else headers[feed.auth.header || 'Authorization'] = (feed.auth.prefix || '') + key;
  }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(url, { headers, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return { json: await r.json() };
  } finally { clearTimeout(timer); }
}

async function main() {
  const root = path.join(__dirname, '..');
  const config = JSON.parse(fs.readFileSync(path.resolve(arg('config', path.join(root, 'roadwork.config.json'))), 'utf8'));
  let previous = null; try { previous = JSON.parse(fs.readFileSync(path.resolve(arg('previous', 'previous.json')), 'utf8')); } catch { /* the first run has none */ }
  const now = new Date(), items = [], sources = [];
  for (const feed of config.feeds || []) {
    const key = feed.auth && feed.auth.secretEnv ? process.env[feed.auth.secretEnv] : '';
    const entry = { id: feed.id, name: feed.name, publisher: feed.publisher || '', license: feed.license || 'CC0-1.0', homepage: feed.homepage || '' };
    try {
      const res = await fetchFeed(feed, key);
      if (res.skipped) { entry.status = 'skipped'; entry.note = res.skipped; }
      else {
        const { items: got, skipped } = normalize(res.json, { source: feed.id, bbox: config.bbox, now });
        items.push(...got); Object.assign(entry, { status: 'ok', fetched: now.toISOString(), count: got.length, skipped });
      }
    } catch (e) { entry.status = 'failed'; entry.note = String(e.message || e).replace(/s+/g, ' ').slice(0, 120); }
    if (entry.status !== 'ok') {
      // keep the last good data for a while, so one bad half hour does not blank the map
      const was = previous && Array.isArray(previous.sources) ? previous.sources.find(x => x.id === feed.id && (x.status === 'ok' || x.status === 'stale')) : null;
      if (was && Date.parse(was.fetched) > now.getTime() - KEEP_MS) {
        const old = (previous.items || []).filter(i => i.source === feed.id); items.push(...old);
        Object.assign(entry, { status: 'stale', fetched: was.fetched, count: old.length });
      }
    }
    sources.push(entry);
  }
  const out = { format: 'orient-roadwork', version: 1, updated: now.toISOString(), area: { name: config.name || '', bbox: config.bbox || null }, sources, items };
  fs.writeFileSync(path.resolve(arg('out', 'roadwork.json')), JSON.stringify(out) + '\n');
  console.log('road work: ' + items.length + ' items; ' + out.sources.map(s => s.id + ' ' + s.status).join(', '));
}
if (require.main === module) main().catch(e => { console.error('road work fetch failed: ' + (e && e.message)); process.exit(1); });
module.exports = { fetchFeed };
