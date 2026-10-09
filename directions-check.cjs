// Directions open in the chosen maps app.  ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node directions-check.cjs
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const seed = { version: 1, custom: [{ id: 'local-roast', name: 'Glass City Roasters (West)', kind: 'Coffee shop', icon: 'coffee', coordinates: [-83.5395, 41.6535], address: 'Toledo, OH', note: '', demo: false }], osm: [], ratings: {}, saved: [], visited: [], drafts: {}, details: {}, events: [], showDemo: false, fog: false };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const open = async (opts = {}) => {
      const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 }, ...opts });
      await ctx.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } }, seed);
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL_); await page.waitForFunction(() => window.OrientDirections && document.querySelector('#sheet'), null, { timeout: 20000 });
      await page.locator('#search').fill('Glass City Roasters');
      if (!(await page.locator('#panel [data-place="local-roast"]').count())) await page.getByRole('button', { name: 'Switch to list', exact: true }).click();
      await page.locator('#panel [data-place="local-roast"]').click();
      await page.evaluate(() => { document.querySelector('#sheet button.expand[aria-expanded=false]')?.click(); });
      await page.waitForSelector('#sheet a[data-dir]');
      page.errors = errors; return page;
    };
    const href = p => p.locator('#sheet a[data-dir]').first().getAttribute('href');
    const LL = '41.6535,-83.5395';

    const desk = await open();
    assert.match(await href(desk), /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=41\.6535%2C-83\.5395&travelmode=driving$/);
    assert.equal(await desk.locator('#sheet a[data-dir]').first().getAttribute('target'), '_blank');
    console.log('ok  desktop automatic opens Google Maps');

    // changing the setting rewrites the link that is already on screen
    await desk.click('[data-action="settings"]');
    for (const [app, re] of [['apple', /^https:\/\/maps\.apple\.com\/\?daddr=41\.6535,-83\.5395&dirflg=d$/], ['waze', /^https:\/\/waze\.com\/ul\?ll=41\.6535,-83\.5395&navigate=yes$/], ['osm', /^https:\/\/www\.openstreetmap\.org\/directions\?engine=fossgis_osrm_car&route=%3B41\.6535%2C-83\.5395$/], ['google', /google\.com\/maps\/dir/]]) {
      await desk.selectOption('#dir-app', app);
      assert.match(await href(desk), re, app);
    }
    await desk.selectOption('#dir-app', 'apple');
    await desk.reload(); await desk.waitForFunction(() => window.OrientDirections);
    assert.equal(await desk.evaluate(() => OrientDirections.get()), 'apple');
    console.log('ok  choosing an app rewrites the link, and the choice is remembered');

    const iphone = await open({ userAgent: IPHONE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    assert.match(await href(iphone), /^https:\/\/maps\.apple\.com\/\?daddr=/);
    console.log('ok  iPhone automatic opens Apple Maps');

    const android = await open({ userAgent: ANDROID, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    assert.equal(await href(android), 'geo:' + LL + '?q=' + LL + '(Glass%20City%20Roasters%20%20West%20)');
    console.log('ok  Android automatic hands the place to the phone\'s own maps choice');

    // walking mode for circuits
    assert.match(await desk.evaluate(() => OrientDirections.url([-83.5, 41.6], 'x', 'walking', 'apple')), /dirflg=w$/);
    assert.match(await desk.evaluate(() => OrientDirections.url([-83.5, 41.6], 'x', 'walking', 'google')), /travelmode=walking$/);
    assert.match(await desk.evaluate(() => OrientDirections.url([-83.5, 41.6], 'x', 'walking', 'osm')), /fossgis_osrm_foot/);
    for (const p of [desk, iphone, android]) assert.deepEqual(p.errors, []);
    console.log('PASS: directions follow the chosen maps app');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
