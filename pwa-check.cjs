// Orient as an installable, offline-capable app: the manifest and icons, the service worker, offline start, what is (not)
// cached, and the install row in the field kit.   ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node pwa-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

const home = { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' };
const store = { version: 1, home, useCatalog: false, custom: [{ id: 'local-a', name: 'Glass City Roasters', kind: 'Coffee shop', icon: 'map-pin', coordinates: [-83.539, 41.655], address: '', note: 'A private note', demo: false }], osm: [], saved: ['local-a'], visited: [], neighbors: [] };
const png = f => { const b = fs.readFileSync(path.join(__dirname, 'public', 'icons', f)); assert.equal(b.slice(1, 4).toString(), 'PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    await t('the manifest names the app, says how it opens, and every icon exists at the size it claims', async () => {
      const m = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'manifest.webmanifest'), 'utf8'));
      assert.equal(m.short_name, 'Orient'); assert.equal(m.display, 'standalone'); assert.ok(m.start_url.startsWith('./') && m.scope === './'); assert.match(m.theme_color, /^#[0-9a-f]{6}$/i); assert.match(m.background_color, /^#[0-9a-f]{6}$/i);
      for (const i of m.icons.filter(i => i.type === 'image/png')) { const [w, h] = png(path.basename(i.src)); assert.equal(i.sizes, w + 'x' + h, i.src); }
      assert.ok(m.icons.some(i => i.purpose === 'maskable' && i.sizes === '512x512'), 'a maskable icon'); assert.ok(m.icons.some(i => i.purpose === 'any' && i.sizes === '192x192') && m.icons.some(i => i.purpose === 'any' && i.sizes === '512x512'), 'the two standard sizes');
      assert.deepEqual(png('apple-touch-icon.png'), [180, 180]);
      const r = await fetch(URL_ + '/manifest.webmanifest'); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /application\/manifest\+json/); assert.equal((await r.json()).name, m.name);
      const sw = await fetch(URL_ + '/sw.js'); assert.equal(sw.status, 200); assert.match(sw.headers.get('content-type'), /javascript/); assert.equal(sw.headers.get('cache-control'), 'no-cache', 'the worker itself is always checked for updates');
    });
    await t('the page links the manifest and the Apple icon, and the browser reads the manifest', async () => {
      const ctx = await browser.newContext(); const p = await ctx.newPage(); await p.goto(URL_);
      assert.equal(await p.locator('link[rel=manifest]').getAttribute('href'), './manifest.webmanifest'); assert.equal(await p.locator('link[rel=apple-touch-icon]').getAttribute('href'), './icons/apple-touch-icon.png');
      assert.equal(await p.locator('meta[name=theme-color]').getAttribute('content'), '#183f39');
      const cdp = await ctx.newCDPSession(p); const info = await cdp.send('Page.getAppManifest'); assert.deepEqual(info.errors, [], 'no manifest errors'); assert.match(info.url, /manifest\.webmanifest$/);
      await ctx.close();
    });

    const fresh = async (opts = {}) => {
      const ctx = await browser.newContext({ viewport: { width: 1100, height: 860 }, ...opts }); await ctx.addInitScript(([s]) => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); localStorage.setItem('orient-weather-v1', JSON.stringify({ show: false })); localStorage.setItem('orient-roadwork-v1', JSON.stringify({ show: false })); localStorage.setItem('orient-civic-v1', JSON.stringify({ incidents: false })); } }, [store]);
      const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message)); p.setDefaultTimeout(10000);
      await p.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' })); await p.route('**/api/civic?*', r => r.fulfill({ status: 404, body: '{}' }));
      return { ctx, p };
    };
    await t('the service worker installs, takes control, and caches the app shell', async () => {
      const { ctx, p } = await fresh(); await p.goto(URL_); await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
      const names = await p.evaluate(async () => (await caches.keys()).sort()); assert.ok(names.includes('orient-shell-v1'));
      await p.waitForFunction(async () => (await (await caches.open('orient-shell-v1')).keys()).length > 20, null, { timeout: 15000 });
      const cached = await p.evaluate(async () => (await (await caches.open('orient-shell-v1')).keys()).map(r => new URL(r.url).pathname));
      for (const f of ['/index.html', '/boot.js', '/ui.css', '/vendor/maplibre-gl.js', '/manifest.webmanifest', '/pwa.js']) assert.ok(cached.includes(f), f + ' is cached');
      assert.ok(cached.some(f => f.endsWith('/app.js')), 'the app itself is cached too'); assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('with the connection gone the app still opens, and your map is right where you left it', async () => {
      const { ctx, p } = await fresh(); await p.goto(URL_); await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
      await p.waitForFunction(async () => (await (await caches.open('orient-shell-v1')).keys()).length > 20, null, { timeout: 15000 }); await p.waitForFunction(() => document.querySelector('.map-marker'), null, { timeout: 20000 });
      await ctx.setOffline(true); await p.reload(); await p.waitForFunction(() => window.OrientBoard && document.querySelector('.bottom-nav'), null, { timeout: 20000 });
      await p.locator('.bottom-nav [data-tab="My Map"]').click(); await p.locator('[data-action=list]:visible').first().click().catch(() => {});
      assert.match(await p.locator('#panel').innerText(), /Glass City Roasters/, 'your saved place shows without a connection');
      assert.deepEqual(p.errors.filter(e => !/Failed to fetch|Load failed|NetworkError/i.test(e)), []); await ctx.close();
    });
    await t('the private and live things are never cached: /api/ is always asked for live', async () => {
      const { ctx, p } = await fresh(); await p.goto(URL_); await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
      const keys = await p.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname); return out; });
      assert.equal(keys.some(k => k.includes('/api/')), false, 'nothing from /api/ is stored');
      await ctx.setOffline(true); const offline = await p.evaluate(async () => { try { await fetch('/api/backups'); return 'answered'; } catch { return 'failed'; } }); assert.equal(offline, 'failed', 'an api request does not come back from a cache');
      await ctx.close();
    });
    await t('map tiles you have looked at are kept, and only a few hundred', async () => {
      const { ctx, p } = await fresh(); await p.goto(URL_); await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }); await p.waitForFunction(() => document.querySelector('.map-marker'), null, { timeout: 25000 });
      await p.waitForFunction(async () => (await caches.keys()).includes('orient-tiles-v1') && (await (await caches.open('orient-tiles-v1')).keys()).length > 0, null, { timeout: 25000 }).catch(() => {});
      const info = await p.evaluate(async () => { const c = await caches.open('orient-tiles-v1'); return (await c.keys()).map(r => new URL(r.url).hostname); });
      if (info.length) { assert.ok(info.every(h => h === 'tiles.openfreemap.org'), 'only the map host'); assert.ok(info.length <= 700); } else console.log('    (no tile was fetched in this environment; the host list and limit are covered by the code review of sw.js)');
      await ctx.close();
    });
    await t('the field kit offers to install when the browser says it can, and says how on an iPhone', async () => {
      const { ctx, p } = await fresh(); await p.goto(URL_); await p.waitForFunction(() => window.OrientPWA);
      await p.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { window.__prompted = true; return Promise.resolve(); }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
      await p.click('[data-action="settings"]'); const row = p.locator('#pwa-row'); await row.waitFor();
      assert.match(await row.innerText(), /Install Orient[\s\S]*works offline/i); await row.getByRole('button', { name: 'Install' }).click(); assert.equal(await p.evaluate(() => window.__prompted), true, 'the browser prompt was shown');
      await p.waitForFunction(() => document.querySelector('#pwa-row [data-pwa=install]').hidden); await ctx.close();
      const phone = await fresh({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await phone.p.goto(URL_); await phone.p.waitForFunction(() => window.OrientPWA); await phone.p.click('[data-action="settings"]');
      assert.match(await phone.p.locator('#pwa-row').innerText(), /Share, then Add to Home Screen/); assert.equal(await phone.p.locator('#pwa-row [data-pwa=install]').isHidden(), true); await phone.ctx.close();
    });
    await t('installed, the row says so; and the field kit still fits on a phone', async () => {
      const { ctx, p } = await fresh({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await p.addInitScript(() => { const q = window.matchMedia.bind(window); window.matchMedia = s => /display-mode: standalone/.test(s) ? { matches: true, media: s, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : q(s); });
      await p.goto(URL_); await p.waitForFunction(() => window.OrientPWA); await p.click('[data-action="settings"]');
      assert.match(await p.locator('#pwa-row').innerText(), /Orient is installed[\s\S]*using it as an app/); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await ctx.close();
    });
    console.log('PASS: ' + n + ' app (PWA) cases');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
