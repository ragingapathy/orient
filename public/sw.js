'use strict';
/* Orient's service worker: it makes the app open without a connection and keeps the map areas you have looked at.
   It stores only the app's own files and public map tiles, on this device. It never touches /api/ (your synced map,
   backups, sharing and anything private is always asked for live), and it leaves every other site alone. */
const SHELL = 'orient-shell-v1', TILES = 'orient-tiles-v1', KEEP = [SHELL, TILES];
const TILE_HOSTS = ['tiles.openfreemap.org'], MAX_TILES = 700, WAIT_MS = 4000;
const scoped = path => new URL(path, self.registration.scope).toString();

// the first visit caches the files the page names, so the next visit works offline
async function precache() {
  const cache = await caches.open(SHELL);
  const res = await fetch(scoped('./index.html'), { cache: 'no-cache' }); if (!res.ok) return;
  const html = await res.clone().text(); await cache.put(scoped('./'), res.clone()); await cache.put(scoped('./index.html'), res);
  const files = new Set([...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(m => m[1]));
  try { const boot = await (await fetch(scoped('./boot.js'), { cache: 'no-cache' })).text(); const app = boot.match(/\.\/app\.js\?v=[^'"]+/); if (app) files.add(app[0]); } catch { /* the page still works online */ }
  await Promise.allSettled([...files].map(async f => { const r = await fetch(scoped(f)); if (r.ok) await cache.put(scoped(f), r); }));
}

self.addEventListener('install', e => { e.waitUntil(precache().catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil((async () => { for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k); await self.clients.claim(); })()); });

// online, the newest file wins; offline or slow, the last good copy is used
async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), WAIT_MS);
    const res = await fetch(req, { signal: ctl.signal }).finally(() => clearTimeout(t));
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    if (req.mode === 'navigate') return (await cache.match(scoped('./index.html'))) || (await cache.match(scoped('./'))) || Response.error();
    return Response.error();
  }
}
// map tiles: show what we have straight away, refresh it quietly, and keep only a few hundred
async function tiles(req) {
  const cache = await caches.open(TILES), hit = await cache.match(req);
  const fresh = fetch(req).then(async res => {
    if (res.ok) { await cache.put(req, res.clone()); const keys = await cache.keys(); for (const k of keys.slice(0, Math.max(0, keys.length - MAX_TILES))) await cache.delete(k); }
    return res;
  }).catch(() => null);
  return hit || (await fresh) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) { if (url.pathname.includes('/api/')) return; e.respondWith(networkFirst(req)); }
  else if (TILE_HOSTS.includes(url.hostname)) e.respondWith(tiles(req));
});
self.addEventListener('message', e => { if (e.data === 'skip-waiting') self.skipWaiting(); });
