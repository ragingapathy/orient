// The Civic tab: the strip of tiles, weather, road work, incidents, cameras, mapped plate readers and Useful nearby, plus the map
// layers, hover cards and dialogs.   ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node civic-board-check.cjs
// Every file is a mock (civic-mock.cjs, weather-mock.cjs); camera pictures are a one-pixel image. Nothing real is contacted.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const { forecast, archive, alertOf } = require('./weather-mock.cjs');
const M = require('./civic-mock.cjs');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const home = { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' };
const store = (h = home) => ({ version: 1, home: h, useCatalog: false, custom: [{ id: 'local-a', name: 'Glass City Roasters', kind: 'Coffee shop', icon: 'map-pin', coordinates: [-83.539, 41.655], address: '', note: 'A private note', demo: false }], osm: [], saved: ['local-a'], visited: [], neighbors: [{ id: 'n1', name: 'Secret Neighbor', note: 'Private' }] });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const open = async (o = {}) => {
      const { files = {}, fail = false, s = store(), viewport = { width: 1200, height: 860 }, gidgit = false, alerts = false, weatherOn = true, rwOff = false } = o;
      const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
      await ctx.addInitScript(([st, g, w, rw]) => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(st)); if (!w) localStorage.setItem('orient-weather-v1', JSON.stringify({ show: false })); if (g) localStorage.setItem('orient-gidgit-enabled', 'true'); if (rw) localStorage.setItem('orient-roadwork-v1', JSON.stringify({ show: false })); } }, [s, gidgit, weatherOn, rwOff]);
      const page = await ctx.newPage(); page.errors = []; page.log = []; page.on('pageerror', e => page.errors.push(e.message)); page.setDefaultTimeout(8000);
      await page.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' }));
      await page.route('**/api/civic?*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ format: 'orient-civic', version: 1, sourceId: 'fixture', center: s.home.coordinates, updated: new Date().toISOString(), air: [{ aqi: 38, category: 'Good', area: 'Toledo', pollutant: 'PM2.5', agency: 'Fixture agency', localTime: 'Today', coordinates: s.home.coordinates, observedAt: new Date().toISOString() }], amenities: [{ id: 'park', name: 'Fixture Park', coordinates: [-83.53, 41.65], amenities: ['Restrooms', 'Benches'] }], fuel: [] }) }));
      await page.route(/open-meteo\.com|api\.weather\.gov/, r => { const u = r.request().url(), json = b => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) }); if (u.includes('archive')) return json(archive(u)); if (u.includes('weather.gov')) return json(alerts ? alertOf(false) : { features: [] }); return json(forecast(63)); });
      await page.route(/itscameras\.example/, r => { page.log.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
      await page.route(/raw\.githubusercontent\.com/, r => {
        const u = r.request().url(); page.log.push(u); if (fail) return r.abort();
        const name = (u.match(/\/(roadwork|incidents|cameras|alpr)\.json/) || [])[1]; const body = files[name] || M[name]();
        r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      });
      await page.goto(URL_); await page.waitForFunction(() => window.OrientBoard && document.querySelector('.map-marker'), null, { timeout: 30000 });
      return page;
    };
    const civic = async (p, section = 'overview') => { await p.locator('.bottom-nav [data-tab="Civic"]').click(); await p.locator('#civic-tab-overview').waitFor(); await p.locator('#civic-tab-' + section).click(); await p.waitForFunction(id => document.getElementById('civic-tab-' + id).getAttribute('aria-selected') === 'true', section); if (section === 'overview') await p.locator('#panel .rb-tiles').waitFor(); await p.waitForFunction(() => OrientBoard.state().loaded.length >= 3); await p.waitForTimeout(500); return p.locator('#panel'); };
    const layers = p => p.evaluate(() => OrientBoard.mapLayers());
    const hoverAt = async (p, lng, lat) => { const at = await p.evaluate(([x, y]) => OrientBoard.project(x, y), [lng, lat]); await p.mouse.move(at.x - 40, at.y - 40); await p.mouse.move(at.x, at.y, { steps: 4 }); await p.waitForTimeout(250); return at; };

    await t('Civic is a tab of its own: before Gidgit, which stays last, and the old "Useful nearby" chip is gone', async () => {
      const p = await open({ gidgit: true });
      assert.deepEqual(await p.locator('.bottom-nav button:not([hidden])').evaluateAll(b => b.map(x => x.innerText.trim())), ['Explore', 'My Map', 'Calendar', 'Civic', 'Gidgit']);
      assert.equal(await p.locator('button[aria-label="Useful nearby"]').count(), 0, 'the masthead chip is gone');
      const bar = await p.locator('.bottom-nav').boundingBox(); assert.ok(bar.width <= 1200);
      const tabs = await p.locator('.bottom-nav button:not([hidden])').evaluateAll(b => b.map(x => { const r = x.getBoundingClientRect(); return r.width > 40 && r.height > 36; })); assert.ok(tabs.every(Boolean), 'every tab is a decent tap target');
      const q = await open(); assert.equal(await q.locator('.bottom-nav button:not([hidden])').count(), 4);
    });
    await t('the strip shows the day at a glance, and each tile jumps to its section', async () => {
      const p = await open({ alerts: true }); const panel = await civic(p);
      const tiles = (await panel.locator('.rb-tiles .ui-tile').allInnerTexts()).map(x => x.replace(/\s+/g, ' ').trim());
      assert.match(tiles[0], /^55°/); assert.match(tiles[0], /1 weather alert/); assert.match(tiles[1], /^2 roads closed nearby/); assert.match(tiles[2], /^3 incidents nearby/); assert.match(tiles[3], /^4 plate readers within 5 mi/i);
      assert.match(await panel.locator('.rb-sub').innerText(), /5 state traffic cameras in the region/);
      await panel.locator('.rb-tiles .ui-tile').nth(3).click(); await p.locator('#rb-alpr').waitFor();
      assert.equal(await p.locator('#civic-tab-cameras').getAttribute('aria-selected'), 'true', 'the tile opened the Cameras section');
      assert.deepEqual(p.errors, []);
    });
    await t('the sections: weather and alerts and Useful nearby; road work and incidents; cameras and plate readers; amenities', async () => {
      const p = await open({ alerts: true }); let panel = await civic(p);
      const heads = async () => panel.locator('.rb-card .rb-head h3').evaluateAll(h => h.map(x => x.childNodes[0].textContent.trim()));
      assert.deepEqual(await heads(), ['Weather and alerts', 'Useful nearby']);
      assert.match(await panel.locator('#rb-weather').innerText(), /55° · Rain[\s\S]*Wind Advisory/);
      await panel.locator('#rb-useful [data-civic-body]').getByText('38 · Good', { exact: true }).waitFor();
      panel = await civic(p, 'conditions'); assert.deepEqual(await heads(), ['Road work and closures', 'Incidents']);
      assert.match(await panel.locator('#rb-roadwork').innerText(), /Anthony Wayne Trail|I-75/); assert.equal(await panel.locator('#rb-roadwork [data-board=roadwork]').count(), 1);
      const inc = await panel.locator('#rb-incidents .rb-row').allInnerTexts(); assert.equal(inc.length, 3); assert.match(inc[0], /I-75 · Northbound/); assert.match(inc[0], /Crash/);
      panel = await civic(p, 'cameras'); assert.deepEqual(await heads(), ['Traffic cameras', 'License plate readers']);
      assert.equal(await panel.locator('#rb-cameras .rb-cam').count(), 4); assert.match(await panel.locator('#rb-cameras .rb-cam').first().innerText(), /I-75 at Exit 1/);
      const alpr = await panel.locator('#rb-alpr').innerText(); assert.match(alpr, /4 mapped within about 5 miles/); assert.match(alpr, /2 operators/); assert.match(alpr, /Lucas County Sheriff/); assert.match(alpr, /Flock Safety/);
      await panel.locator('#rb-alpr details summary').click(); assert.match(await panel.locator('#rb-alpr details').innerText(), /DeFlock[\s\S]*OpenStreetMap contributors[\s\S]*Open Database License/);
      assert.deepEqual(p.errors, []);
    });
    await t('on the Civic tab every layer is on; elsewhere only the ones you chose, and a switch you flip sticks', async () => {
      const p = await open(); await civic(p); await p.waitForFunction(() => { const l = OrientBoard.mapLayers(); return l && l.alpr && l.cameras && l.incidents; });
      const on = await layers(p); assert.deepEqual([on.incidents.visible, on.cameras.visible, on.alpr.visible], [true, true, true]); assert.equal(on.alpr.features, 7); assert.equal(on.cameras.features, 5);
      await p.locator('.bottom-nav [data-tab="Explore"]').click(); await p.waitForFunction(() => { const l = OrientBoard.mapLayers(); return l.cameras && !l.cameras.visible && !l.alpr.visible; });
      const off = await layers(p); assert.deepEqual([off.incidents.visible, off.cameras.visible, off.alpr.visible], [true, false, false], 'incidents stay; cameras and plate readers were never chosen');
      await civic(p, 'cameras'); await p.locator('#rb-alpr .rb-switch input').uncheck(); await p.locator('#rb-cameras .rb-pin').click(); await p.waitForTimeout(400);
      await p.locator('.bottom-nav [data-tab="My Map"]').click(); await p.waitForFunction(() => { const l = OrientBoard.mapLayers(); return l.cameras.visible && !l.alpr.visible; });
      const mine = await layers(p); assert.deepEqual([mine.cameras.visible, mine.alpr.visible], [true, false], 'your choice follows you to the other tabs');
      assert.match(await (await civic(p, 'cameras')).locator('#rb-cameras .rb-switch span').innerText(), /^On the map$/);
    });
    await t('hovering a plate reader shows who runs it and which way it faces, and draws its view on the map', async () => {
      const p = await open(); await civic(p); await p.waitForFunction(() => OrientBoard.mapLayers() && OrientBoard.mapLayers().alpr);
      await p.evaluate(() => OrientBoard.flyTo(-83.640, 41.640, 15.5)); await p.waitForTimeout(2200);
      // the reader at 41.640,-83.560 faces 345 degrees
      await p.evaluate(() => OrientBoard.flyTo(-83.560, 41.640, 16)); await p.waitForTimeout(2200);
      await hoverAt(p, -83.560, 41.640);
      const card = p.locator('.civic-hover'); await card.waitFor();
      const text = await card.innerText(); assert.match(text, /License plate reader/i); assert.match(text, /Flock Safety · Toledo Police Department/); assert.match(text, /faces north \(345°\)|faces northwest \(345°\)/);
      assert.equal(await p.evaluate(() => OrientBoard.hoverCount()), 1, 'the field of view of the reader is drawn on the map');
      await p.mouse.move(5, 300); await p.waitForTimeout(300); assert.equal(await card.isVisible(), false, 'it goes away when the pointer leaves'); assert.equal(await p.evaluate(() => OrientBoard.hoverCount()), 0, 'and so does the view');
    });
    await t('hovering a closed road shows the closure, and a camera shows its picture', async () => {
      const p = await open(); await civic(p);
      await p.evaluate(() => OrientBoard.flyTo(-83.58, 41.62, 15)); await p.waitForTimeout(2200);
      await hoverAt(p, -83.58, 41.62); const card = p.locator('.civic-hover'); await card.waitFor();
      assert.match(await card.innerText(), /Closed[\s\S]*I-75 · Northbound[\s\S]*All lanes closed for bridge demolition[\s\S]*Miami St to Front St|All lanes closed for bridge demolition/);
      await p.evaluate(() => OrientBoard.flyTo(-83.545, 41.655, 15)); await p.waitForTimeout(2200);
      await hoverAt(p, -83.545, 41.655); await card.waitFor();
      assert.match(await card.innerText(), /I-75 at Exit 1/); assert.match(await card.innerText(), /Click for the live picture/); assert.equal(await card.locator('img.rb-thumb').count(), 1);
    });
    await t('a tap opens the detail: an incident, a plate reader with its sources, a camera with its views and a refreshing picture', async () => {
      const p = await open(); let panel = await civic(p, 'conditions');
      await panel.locator('#rb-incidents [data-board=detail]').first().click(); const d = p.locator('#board-dialog'); await d.waitFor();
      assert.match(await d.innerText(), /Crash · Partly closed[\s\S]*Crash blocking the right lane[\s\S]*Ohio Department of Transportation/); await d.locator('[data-board=close]').click();
      await panel.locator('#rb-incidents [data-board=detail]').nth(1).click(); assert.equal(await d.locator('img, script').count(), 0, 'text from the feed is never markup'); assert.match(await d.innerText(), /<img src=x onerror=alert\(1\)>/); await d.locator('[data-board=close]').click();
      panel = await civic(p, 'cameras'); await panel.locator('#rb-alpr [data-board=detail]').first().click();
      const text = await d.innerText(); assert.match(text, /license plate reader/i); assert.match(text, /mapped by a volunteer on OpenStreetMap/); assert.match(text, /Mapped by volunteers, so it can be incomplete/);
      assert.match(await d.locator('a[href*="openstreetmap.org/node/"]').getAttribute('href'), /^https:\/\/www\.openstreetmap\.org\/node\/\d+$/); assert.equal(await d.locator('a[href="https://deflock.org/"]').count(), 1); await d.locator('[data-board=close]').click();
      await panel.locator('#rb-cameras .rb-cam').first().click(); await d.locator('.rb-live').waitFor();
      assert.equal(await d.locator('.rb-views button').count(), 2, 'two views of this camera'); assert.match(await d.locator('.rb-live').getAttribute('src'), /itscameras\.example\/images\/toledo\/c1\.jpg\?_=\d+/);
      await d.getByRole('button', { name: 'Northbound' }).click(); assert.match(await d.locator('.rb-live').getAttribute('src'), /c1n\.jpg/);
      await d.locator('.rb-live').evaluate(i => i.complete); await p.waitForFunction(() => document.querySelector('.rb-shot-note').hidden === true);
      await d.locator('[data-board=close]').click(); await p.waitForFunction(() => !document.querySelector('.rb-live').getAttribute('src')); assert.equal(await p.locator('.rb-live').getAttribute('src'), null, 'the picture stops loading when you close it');
      assert.deepEqual(p.errors, []);
    });
    await t('Show takes the map to a thing; clicking a cluster zooms in', async () => {
      const p = await open(); const panel = await civic(p, 'cameras');
      await panel.locator('#rb-alpr [data-board=detail]').first().click(); const d = p.locator('#board-dialog');
      const before = await p.evaluate(() => OrientRoadwork.view().zoom); await d.locator('[data-board=show]').click(); await p.waitForTimeout(1100);
      assert.ok((await p.evaluate(() => OrientRoadwork.view().zoom)) >= 14.9, 'zoomed to the reader (was ' + before + ')');
    });
    await t('a cluster of plate readers zooms in when clicked, and a closer look shows them one by one', async () => {
      const p = await open(); await civic(p); await p.waitForFunction(() => OrientBoard.mapLayers() && OrientBoard.mapLayers().alpr);
      await p.evaluate(() => OrientBoard.flyTo(-83.54, 41.655, 9)); await p.waitForTimeout(1200);
      const cl = await p.evaluate(() => OrientBoard.firstCluster('alpr')); assert.ok(cl && cl.count >= 2, 'readers close together are one cluster at city scale');
      const before = await p.evaluate(() => OrientRoadwork.view().zoom); await p.mouse.move(cl.x, cl.y); await p.mouse.click(cl.x, cl.y); await p.waitForTimeout(1200);
      assert.ok((await p.evaluate(() => OrientRoadwork.view().zoom)) > before + 1, 'the map zoomed in on the cluster');
    });
    await t('Closures is a filter chip in Explore: it opens the list, shows only closures on the map, and the next filter ends it', async () => {
      const p = await open({ rwOff: true }); await p.waitForFunction(() => OrientRoadwork.source());
      assert.equal(await p.evaluate(() => OrientRoadwork.mapLayers()), null, 'road work is switched off in the field kit, so nothing is drawn');
      await p.locator('[data-action="filters"]').first().click(); const chip = p.locator('#filter-options [data-closures]'); await chip.waitFor();
      assert.equal(await chip.getAttribute('aria-pressed'), 'false'); assert.match(await chip.innerText(), /Closures/);
      await chip.click(); await p.locator('#roadwork-dialog[open]').waitFor();
      assert.equal(await p.locator('.world').getAttribute('data-view'), 'closures'); assert.equal(await p.locator('#filter-options [data-closures]').getAttribute('aria-pressed'), 'true');
      await p.waitForFunction(() => OrientRoadwork.mapLayers() && OrientRoadwork.mapLayers().layers.length === 5);
      await p.waitForFunction(() => { const l = OrientBoard.mapLayers(); return l.incidents && l.incidents.visible; });
      const during = await p.evaluate(() => OrientBoard.mapLayers()); assert.ok(!during.cameras || !during.cameras.visible); assert.ok(!during.alpr || !during.alpr.visible);
      assert.ok(await p.locator('#roadwork-dialog .rw-card').count() > 0, 'the closures list is what opened');
      await p.keyboard.press('Escape'); await p.locator('#filter-options [data-filter="Specials"]').click();
      await p.waitForFunction(() => document.querySelector('.world').dataset.view === ''); await p.waitForFunction(() => OrientRoadwork.mapLayers() === null);
      assert.equal(await p.evaluate(() => OrientBoard.closuresView()), false, 'choosing another filter ended it'); assert.deepEqual(p.errors, []);
    });
    await t('Closures lives in Explore only: not on the Civic tab, not in My Map, and leaving Explore ends the view', async () => {
      const p = await open(); await civic(p); assert.equal(await p.locator('.rb-filters, [data-closures], [data-closures-clear]').count(), 0, 'no pills on the Civic tab');
      await p.locator('.bottom-nav [data-tab="My Map"]').click(); await p.locator('[data-action="filters"]').first().click().catch(() => {}); await p.waitForTimeout(300);
      assert.equal(await p.locator('#filter-options [data-closures]').count(), 0, 'no Closures chip in My Map');
      await p.locator('.bottom-nav [data-tab="Explore"]').click(); await p.waitForTimeout(300);
      if (!(await p.locator('#filters').isVisible())) await p.locator('[data-action="filters"]').first().click();
      await p.locator('#filter-options [data-closures]').click(); await p.locator('#roadwork-dialog[open]').waitFor(); await p.keyboard.press('Escape');
      assert.equal(await p.evaluate(() => OrientBoard.closuresView()), true);
      await p.locator('.bottom-nav [data-tab="Civic"]').click(); await p.waitForFunction(() => OrientBoard.closuresView() === false);
      assert.equal(await p.locator('.world').getAttribute('data-view'), '', 'the map is back to normal'); assert.deepEqual(p.errors, []);
    });
    await t('only the commons files are fetched, and camera pictures only from the camera host', async () => {
      const p = await open(); await civic(p, 'cameras'); await p.waitForTimeout(500);
      const hosts = [...new Set(p.log.map(u => new URL(u).host))].sort(); assert.deepEqual(hosts, ['itscameras.example', 'raw.githubusercontent.com']);
      assert.deepEqual([...new Set(p.log.filter(u => u.includes('raw.')).map(u => u.split('/').pop()))].sort(), ['alpr.json', 'cameras.json', 'incidents.json', 'roadwork.json']);
      assert.equal(p.log.filter(u => u.includes('raw.')).every(u => !u.includes('?')), true, 'no query strings: nothing about you is added');
      const q = await open(); await q.waitForTimeout(800); assert.equal(q.log.some(u => u.includes('itscameras')), false, 'no camera pictures until the Civic tab is opened');
    });
    await t('a missing feed says so quietly, and the rest still works', async () => {
      const p = await open({ fail: true }); await p.locator('.bottom-nav [data-tab="Civic"]').click(); await p.locator('#panel .rb-card').first().waitFor(); await p.waitForTimeout(800);
      const text = await p.locator('#panel').innerText(); assert.match(text, /Weather and alerts/); assert.match(text, /roads closed nearby/);
      await p.locator('#civic-tab-conditions').click(); await p.waitForTimeout(400); assert.match(await p.locator('#panel').innerText(), /aren’t available right now|Loading|No road conditions feed/);
      assert.deepEqual(p.errors, []);
    });
    await t('an area with no feeds still gets weather and Useful nearby, and an honest note', async () => {
      const p = await open({ s: store({ name: 'Chicago', coordinates: [-87.63, 41.88], timeZone: 'America/Chicago' }) }); await p.locator('.bottom-nav [data-tab="Civic"]').click(); await p.locator('#panel h2').waitFor();
      const text = await p.locator('#panel').innerText(); assert.match(text, /Weather and alerts/); assert.equal(await p.locator('#rb-useful').count(), 1, 'Useful nearby is still there'); assert.equal(await p.locator('[data-closures]').count(), 0, 'no Closures chip where there is no source');
      await p.locator('#civic-tab-conditions').click(); assert.match(await p.locator('#panel').innerText(), /No road conditions feed for this area yet/); await p.locator('#civic-tab-cameras').click(); assert.match(await p.locator('#panel').innerText(), /No camera feed for this area yet/);
      assert.equal(p.log.filter(u => u.includes('raw.')).length, 0, 'nothing is requested');
    });
    await t('the file is checked: wrong formats, bad positions, insecure pictures and junk are refused or dropped', async () => {
      const p = await open();
      const r = await p.evaluate(() => { const ok = OrientBoard.validate; const good = { format: 'orient-cameras', version: 1, updated: new Date().toISOString(), source: { status: 'ok' }, items: [{ id: 'a', lat: 41, lng: -83, location: 'x', views: [{ direction: 'N', small: 'http://insecure.example/a.jpg', large: '' }, { direction: 'S', small: 'https://ok.example/a.jpg', large: '' }] }, { id: 'b', lat: 'x', lng: 1, views: [] }, null, { id: 'c', lat: 41, lng: -83, views: [{ small: 'javascript:alert(1)' }] }] };
        return [ok('cameras', null), ok('cameras', { ...good, version: 2 }), ok('alpr', good), ok('cameras', good).items.length, ok('cameras', good).items[0].views.length, ok('cameras', good).items[0].views[0].small];
      });
      assert.deepEqual(r, [null, null, null, 1, 1, 'https://ok.example/a.jpg']);
    });
    await t('on a phone the tab fits: two-by-two tiles, no sideways scrolling, a tap opens the detail', async () => {
      const p = await open({ viewport: { width: 390, height: 844 }, gidgit: true }); let panel = await civic(p);
      const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('dialog[open]')].every(d => d.scrollWidth <= d.clientWidth + 1));
      assert.equal(await fits(), true, 'the panel fits'); const tb = await panel.locator('.rb-tiles .ui-tile').evaluateAll(t => t.map(x => Math.round(x.getBoundingClientRect().top))); assert.equal(tb[0], tb[1]); assert.ok(tb[2] > tb[0], 'two rows');
      const nav = await p.locator('.bottom-nav button:not([hidden])').evaluateAll(b => b.map(x => { const r = x.getBoundingClientRect(); return r.left >= 0 && r.right <= 390; })); assert.ok(nav.every(Boolean), 'all five tabs are on screen');
      panel = await civic(p, 'cameras'); assert.equal(await fits(), true, 'the cameras section fits');
      await panel.locator('#rb-cameras .rb-cam').first().click(); await p.locator('#board-dialog .rb-live').waitFor(); await p.waitForTimeout(300); assert.equal(await fits(), true, 'the camera dialog fits'); assert.deepEqual(p.errors, []);
    });
    console.log('PASS: ' + n + ' civic tab cases');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
