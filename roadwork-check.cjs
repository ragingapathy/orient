// Road work in Orient: the map layer, the button, the Today line, the list, and what is (not) fetched.
//   ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node roadwork-check.cjs
// The road-work file and the weather are mocks (roadwork-mock.cjs, weather-mock.cjs); nothing real is contacted.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const { forecast, archive } = require('./weather-mock.cjs');
const { roadwork, ROADWORK_URL } = require('./roadwork-mock.cjs');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

const spot = (id, name, i) => ({ id, name, kind: 'Coffee shop', icon: 'map-pin', coordinates: [-83.539 + i * 0.003, 41.655], address: '', note: 'A private note', demo: false });
const baseStore = (home = { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' }) => ({ version: 1, home, useCatalog: false, custom: [spot('local-a', 'Glass City Roasters', 0)], osm: [], saved: ['local-a'], visited: [], neighbors: [{ id: 'n1', name: 'Secret Neighbor', note: 'Private' }] });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const open = async (o = {}) => {
      const { file = roadwork(), fail = false, store = baseStore(), prefs = null, viewport = { width: 1100, height: 860 }, cache = null } = o;
      const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
      await ctx.addInitScript(([s, p, c]) => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); localStorage.setItem('orient-weather-v1', JSON.stringify({ show: false })); localStorage.setItem('orient-civic-v1', JSON.stringify({ incidents: false })); if (p) localStorage.setItem('orient-roadwork-v1', JSON.stringify(p)); if (c) localStorage.setItem('orient-roadwork-cache-v1', JSON.stringify(c)); } }, [store, prefs, cache]);
      const page = await ctx.newPage(); page.errors = []; page.log = []; page.on('pageerror', e => page.errors.push(e.message)); page.setDefaultTimeout(8000);
      await page.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' }));
      await page.route(/raw\.githubusercontent\.com/, r => { page.log.push(r.request().url()); if (fail) return r.abort(); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(file) }); });
      await page.goto(URL_); await page.waitForFunction(() => window.OrientRoadwork && document.querySelector('.map-marker'), null, { timeout: 30000 });
      return page;
    };
    const tool = p => p.locator('#roadwork-tool');
    // The map buttons only show while browsing the map, so the tests that tap one browse first.
    const browse = async p => { await p.waitForSelector('[data-action=explore-map]', { state: 'attached' }); await p.evaluate(() => document.querySelector('[data-action=explore-map]').click()); await tool(p).waitFor(); };

    await t('a closure shows up as a button with a dot, and the list says how many are closed nearby', async () => {
      const p = await open(); await tool(p).waitFor({ state: 'attached' });
      assert.equal(await tool(p).locator('.rw-dot').count(), 1); assert.match(await tool(p).getAttribute('aria-label'), /Road work and closures: 2 closed nearby/);
      assert.deepEqual(p.errors, []);
    });
    await t('only valid items are drawn, as lines with a marker at each start', async () => {
      const p = await open(); await tool(p).waitFor({ state: 'attached' }); await p.waitForFunction(() => OrientRoadwork.mapLayers());
      const m = await p.evaluate(() => OrientRoadwork.mapLayers());
      assert.deepEqual(m.layers.sort(), ['orient-roadwork-casing', 'orient-roadwork-dash', 'orient-roadwork-hit', 'orient-roadwork-points', 'orient-roadwork-solid']);
      assert.equal(m.features, 7 * 2, 'seven valid items, each a line and a start point (junk and broken items are dropped)');
    });
    await t('Today gets a line about closures and restrictions, and it opens the list', async () => {
      const p = await open(); await tool(p).waitFor({ state: 'attached' }); await p.locator('.briefing-handle').click().catch(() => {});
      const strip = p.locator('.roadwork-strip'); await strip.waitFor();
      const text = await strip.innerText(); assert.match(text, /2 roads closed · 2 lane restrictions/); assert.match(text, /1 more starting soon/);
      await strip.click(); await p.locator('#roadwork-dialog[open]').waitFor();
    });
    await t('the list groups what is closed, restricted, starting soon and open, nearest first, with dates and distance', async () => {
      const p = await open(); await browse(p); await tool(p).click(); const d = p.locator('#roadwork-dialog'); await d.locator('.rw-card').first().waitFor();
      assert.deepEqual((await d.locator('.rw-section > .ui-kicker').allInnerTexts()).map(x => x.toLowerCase()), ['closed · 2', 'lane restrictions · 2', 'starting soon · 1', 'work nearby, lanes open · 1']);
      assert.equal(await d.locator('.rw-card').count(), 6, 'the far-away closure is left out, and so is the junk');
      assert.deepEqual(await d.locator('.rw-tiles .ui-tile b').allInnerTexts(), ['2', '2', '1']);
      const first = d.locator('.rw-card').first(); assert.match(await first.innerText(), /I-75 · Northbound[\s\S]*Miami St to Front St[\s\S]*All lanes closed for bridge demolition[\s\S]*Until [A-Z][a-z]{2} \d+ · \d\.\d mi away/);
      assert.match(await d.locator('.rw-card').nth(1).innerText(), /Anthony Wayne Trail · Southbound/, 'nearest first');
      assert.match(await d.locator('.rw-card[data-status="restricted"]').nth(2).innerText().catch(() => ''), /SR 25|Starts/);
      assert.match(await d.locator('[aria-label^="Show I-75"]').first().getAttribute('aria-label'), /Show I-75/);
      assert.match(await d.locator('.fine').innerText(), /Ohio Department of Transportation/); assert.match(await d.locator('.fine').innerText(), /not navigation/);
    });
    await t('both directions of one closure are a single card, and ALL CAPS road names are tidied', async () => {
      const file = roadwork(), base = file.items[0], same = { description: 'State Route 64 at State Route 295 closed for a culvert replacement', from: '', to: '' };
      file.items = [
        { ...base, ...same, id: 'ohgo:pair-n', roads: ['S BERKEY SOUTHERN RD'], direction: 'northbound', geometry: [[-83.56, 41.64], [-83.56, 41.65]] },
        { ...base, ...same, id: 'ohgo:pair-s', roads: ['S BERKEY SOUTHERN RD'], direction: 'southbound', geometry: [[-83.5601, 41.65], [-83.5601, 41.64]] },
        { ...base, id: 'ohgo:other', status: 'restricted', roads: ['US 23', 'N MAIN ST'], direction: 'eastbound', description: 'Right lane closed', geometry: [[-83.6, 41.7], [-83.59, 41.7]] },
      ];
      const p = await open({ file }); await tool(p).waitFor({ state: 'attached' }); await p.waitForFunction(() => OrientRoadwork.mapLayers());
      assert.match(await tool(p).getAttribute('aria-label'), /1 closed nearby/, 'one road closed, not two');
      assert.equal((await p.evaluate(() => OrientRoadwork.mapLayers())).features, 6, 'the map still draws every direction');
      await browse(p); await tool(p).click(); const d = p.locator('#roadwork-dialog'); await d.locator('.rw-card').first().waitFor();
      assert.equal(await d.locator('.rw-card').count(), 2); assert.deepEqual(await d.locator('.rw-tiles .ui-tile b').allInnerTexts(), ['1', '1', '0']);
      assert.match(await d.locator('.rw-card').first().innerText(), /S Berkey Southern Rd · Both directions/);
      assert.match(await d.locator('.rw-card').nth(1).innerText(), /US 23 \/ N Main St · Eastbound/, 'route numbers and compass letters keep their capitals');
      // an intersection closed on all four approaches reads as one closure, in every direction
      const four = roadwork(), b0 = four.items[0]; four.items = ['northbound', 'southbound', 'eastbound', 'westbound'].map(dr => ({ ...b0, id: 'ohgo:x-' + dr, direction: dr, roads: ['STRAYER RD'], description: 'US 20A at Strayer Road closed for a roundabout' }));
      const q = await open({ file: four }); await q.waitForFunction(() => OrientRoadwork.mapLayers()); await browse(q); await tool(q).click();
      assert.equal(await q.locator('#roadwork-dialog .rw-card').count(), 1); assert.match(await q.locator('#roadwork-dialog .rw-card').innerText(), /Strayer Rd · All directions/);
    });
    await t('text from the file is shown as text, never as markup', async () => {
      const p = await open(); await browse(p); await tool(p).click(); const d = p.locator('#roadwork-dialog'); await d.locator('.rw-card').first().waitFor();
      assert.equal(await d.locator('img, script').count(), 0); assert.match(await d.innerText(), /<script>alert\(1\)<\/script> Right lane closed/);
      assert.deepEqual(p.errors, []);
    });
    await t('Show closes the list and takes the map to the road; tapping the road on the map opens its card first', async () => {
      const p = await open(); await browse(p); await tool(p).click(); const d = p.locator('#roadwork-dialog'); await d.locator('.rw-card').first().waitFor();
      const before = await p.evaluate(() => OrientRoadwork.view());
      await d.locator('[data-roadwork=show]').nth(1).click(); await p.waitForTimeout(1200);
      assert.equal(await d.evaluate(e => e.open), false); const after = await p.evaluate(() => OrientRoadwork.view()); assert.ok(after.zoom > before.zoom + 1.5, 'zoomed in on the road: ' + before.zoom + ' to ' + after.zoom);
      const at = await p.evaluate(() => OrientRoadwork.project(-83.58, 41.62)); // the start of the I-75 closure
      const vp = p.viewportSize(); if (at && at.x > 0 && at.y > 60 && at.x < vp.width && at.y < vp.height - 80) { await p.mouse.click(at.x, at.y); }
      else { await p.evaluate(() => OrientRoadwork.open('ohgo:closed-1')); }
      await p.locator('#roadwork-dialog[open]').waitFor();
    });
    await t('an old file gets an honest warning', async () => {
      const p = await open({ file: roadwork({ ageMinutes: 300 }) }); await browse(p); await tool(p).click();
      assert.match(await p.locator('#roadwork-dialog .rw-warn').innerText(), /5 hours old and may be out of date/);
    });
    await t('the field kit switch removes the layer and the button, asks for nothing more, and is remembered', async () => {
      const p = await open(); await tool(p).waitFor({ state: 'attached' }); await p.waitForFunction(() => OrientRoadwork.mapLayers());
      await p.click('[data-action="settings"]'); const box = p.locator('#roadwork-toggle'); assert.equal(await box.isChecked(), true);
      await box.uncheck(); await p.waitForTimeout(300);
      assert.equal(await tool(p).count(), 0); assert.equal(await p.evaluate(() => OrientRoadwork.mapLayers()), null);
      const seen = p.log.length; await p.evaluate(() => OrientRoadwork.refresh(true)); await p.waitForTimeout(300); assert.equal(p.log.length, seen, 'switched off means no request');
      await p.reload(); await p.waitForFunction(() => window.OrientRoadwork); await p.waitForTimeout(500); assert.equal(await tool(p).count(), 0, 'remembered across reloads');
    });
    await t('only the one public file is fetched, with nothing added to the address', async () => {
      const p = await open(); await tool(p).waitFor({ state: 'attached' });
      assert.deepEqual([...new Set(p.log)], [ROADWORK_URL]);
    });
    await t('a recent copy is reused, and when the file cannot be fetched the last good copy still serves', async () => {
      const p = await open(); await tool(p).waitFor({ state: 'attached' }); const first = p.log.length;
      await p.reload(); await p.waitForFunction(() => window.OrientRoadwork); await tool(p).waitFor({ state: 'attached' }); assert.equal(p.log.length, first, 'no second request within ten minutes');
      const cached = await p.evaluate(() => localStorage.getItem('orient-roadwork-cache-v1'));
      const q = await open({ fail: true, cache: { ...JSON.parse(cached), at: Date.now() - 3600e3 } }); await q.waitForTimeout(300); await q.evaluate(() => OrientRoadwork.refresh(true)); await q.waitForTimeout(500); await tool(q).waitFor({ state: 'attached' });
      const lone = await open({ fail: true }); await lone.waitForTimeout(800); assert.equal(await tool(lone).count(), 0, 'with nothing cached and no connection there is no button, and no error'); assert.deepEqual(lone.errors, []);
    });
    await t('an area with no road-work source asks for nothing and says so', async () => {
      const p = await open({ store: baseStore({ name: 'Chicago', coordinates: [-87.63, 41.88], timeZone: 'America/Chicago' }) }); await p.waitForTimeout(600);
      assert.equal(p.log.length, 0, 'no request'); assert.equal(await tool(p).count(), 0);
      await p.click('[data-action="settings"]'); assert.equal(await p.locator('#roadwork-toggle').isDisabled(), true); assert.match(await p.locator('#roadwork-note').innerText(), /No road-work source covers this area yet/);
    });
    await t('the file is checked: the wrong format, the wrong version and junk are refused', async () => {
      const p = await open();
      const r = await p.evaluate(file => [OrientRoadwork.validate(null), OrientRoadwork.validate({}), OrientRoadwork.validate({ ...file, version: 2 }), OrientRoadwork.validate({ ...file, format: 'other' }), OrientRoadwork.validate({ format: 'orient-roadwork', version: 1, items: 'no' }), OrientRoadwork.validate(file).items.length], roadwork());
      assert.deepEqual(r, [null, null, null, null, null, 7]);
    });
    await t('on a phone the button, the Today line and the list fit the screen', async () => {
      const p = await open({ viewport: { width: 390, height: 844 } }); await tool(p).waitFor({ state: 'attached' }); await browse(p);
      const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('dialog[open]')].every(d => d.scrollWidth <= d.clientWidth + 1));
      const box = await tool(p).boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 390 && box.width >= 36);
      await tool(p).click(); await p.locator('#roadwork-dialog .rw-card').first().waitFor(); await p.waitForTimeout(300); assert.equal(await fits(), true, 'the list fits'); assert.deepEqual(p.errors, []);
    });
    console.log('PASS: ' + n + ' road-work cases');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
