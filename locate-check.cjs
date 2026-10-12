// Orient orients: the map moves to you when the app opens and every time the compass is pressed, turns north-up, never tracks,
// and keeps the position in memory only. The GPS is faked (Playwright geolocation), so every case is repeatable.
const assert = require('node:assert/strict'), H = require('./check-helpers.cjs'), { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const URL = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
const HERE = { latitude: 41.6528, longitude: -83.6082, accuracy: 35 };       // a spot in Toledo
const THERE = { latitude: 41.6890, longitude: -83.4700, accuracy: 12 };      // somewhere else in town
const ctxSet = (c, g) => c.setGeolocation(g);
const near = (a, b, d = 0.002) => Math.abs(a[0] - b.longitude) < d && Math.abs(a[1] - b.latitude) < d;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    // Every page counts the location requests it makes (window.__geo) and can hold the first answer back (hold, in ms).
    const open = async (ctx, { seed = true, hold = 0 } = {}) => {
      const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(({ hold: h }) => {
        const g = navigator.geolocation, real = g.getCurrentPosition.bind(g); window.__geo = { once: 0, watch: 0 };
        g.getCurrentPosition = (ok, bad, opts) => { const n = ++window.__geo.once; const run = () => real(ok, bad, opts); if (n === 1 && h) setTimeout(run, h); else run(); };
        g.watchPosition = () => { window.__geo.watch++; return 0; };
      }, { hold });
      if (seed) await H.seed(page, {});
      await page.goto(URL); await page.waitForFunction(() => window.OrientLocate && document.querySelector('[data-action="north"]'), null, { timeout: 20000 });
      return { page, errors };
    };
    const where = page => page.evaluate(() => OrientLocate.state());
    const press = page => page.evaluate(() => document.querySelector('[data-action="north"]').click());
    const settle = async page => { await page.waitForFunction(() => !OrientLocate.state().busy, null, { timeout: 15000 }); await page.waitForTimeout(1100); };

    // 1. Opening the app orients you: a dot at your position, the map centred on it, north-up, close enough to see streets.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['geolocation'], geolocation: HERE, serviceWorkers: 'block' });
    let { page, errors } = await open(ctx);
    await page.waitForFunction(() => OrientLocate.state().hasDot && OrientLocate.state().fix, null, { timeout: 15000 }); await settle(page);
    let s = await where(page);
    assert.ok(near([s.fix.lng, s.fix.lat], HERE), 'the dot is at the fake GPS position');
    assert.ok(near(s.center, HERE), 'the map is centred on you after opening: ' + s.center);
    assert.ok(s.zoom >= 14.9, 'zoomed to street level: ' + s.zoom);
    assert.equal(Math.round(s.bearing), 0);
    assert.equal(await page.locator('.you-marker').count(), 1);
    assert.match(await page.locator('.you-marker').getAttribute('aria-label'), /Your location.*35 metres/);
    assert.equal(await page.locator('.you-marker.has-ring').count(), 1, 'a 35 m fix shows its ring');
    assert.deepEqual(await page.evaluate(() => window.__geo), { once: 1, watch: 0 }, 'one request on open, never a watch');
    assert.match(await page.locator('[data-action="north"]').getAttribute('aria-label'), /Find my location and point north/);

    // The position itself is memory only: the move that orients you is not remembered as the map's saved view either.
    assert.ok(!(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))))).includes(String(HERE.latitude)), 'opening the app saved nothing about where you are');

    // 2. No tracking: you "move", nothing follows until you ask.
    await ctx.setGeolocation(THERE); await page.waitForTimeout(2500);
    s = await where(page); assert.ok(near([s.fix.lng, s.fix.lat], HERE), 'the dot has not followed you');
    assert.deepEqual(await page.evaluate(() => window.__geo), { once: 1, watch: 0 });

    // 3. Pressing the compass: finds you again, centres, and straightens a rotated, wandered map.
    await page.locator('#map canvas').focus(); for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight');
    await page.waitForTimeout(600); s = await where(page); assert.ok(Math.abs(s.bearing) > 10, 'the map was rotated: ' + s.bearing);
    await press(page); await settle(page);
    s = await where(page);
    assert.ok(near([s.fix.lng, s.fix.lat], THERE), 'the dot moved to the new position on the press');
    assert.ok(near(s.center, THERE), 'the map is centred on you again: ' + s.center);
    assert.equal(Math.round(s.bearing), 0, 'north-up after the compass');
    assert.deepEqual(await page.evaluate(() => window.__geo), { once: 2, watch: 0 }, 'exactly one more request per press');
    await press(page); await settle(page); assert.equal((await page.evaluate(() => window.__geo)).once, 3);
    assert.equal(await page.locator('[data-action="north"].locating').count(), 0, 'the pulse stops when it is done');

    // 4. Still memory only after a compass press: the move that centred you on THERE was not saved. (A view you drag or rotate yourself is
    // remembered like any other, as it always was, so only the located move is checked here.)
    assert.ok(!(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))))).includes(String(THERE.latitude)), 'the compass press did not save your position');
    assert.deepEqual(errors, []); await ctx.close();

    // 5. Moving the map before the first answer arrives: the opening orient shows the dot but leaves your map where you put it.
    const slow = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['geolocation'], geolocation: HERE, serviceWorkers: 'block' });
    ({ page, errors } = await open(slow, { hold: 1500 }));
    const before = (await where(page)).center;
    await page.locator('#map canvas').dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 5, clientX: 200, clientY: 400 });
    await page.mouse.move(200, 400); await page.mouse.down(); await page.mouse.move(80, 300, { steps: 6 }); await page.mouse.up();
    await page.waitForFunction(() => OrientLocate.state().fix, null, { timeout: 15000 }); await page.waitForTimeout(1000);
    s = await where(page); assert.ok(!near(s.center, HERE, 0.0015), 'the opening orient did not yank a map you were already moving: ' + s.center);
    assert.ok(s.hasDot, 'the dot still appears');
    await press(page); await settle(page); s = await where(page); assert.ok(near(s.center, HERE), 'but the compass always brings you back');
    assert.deepEqual(errors, []); await slow.close();

    // 6. Location blocked: the compass still straightens the map, says why plainly, and the opening orient stays silent.
    const blocked = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    ({ page, errors } = await open(blocked)); await page.waitForTimeout(1200);
    assert.equal((await where(page)).fix, null); assert.equal(await page.locator('#toast:not([hidden])').count(), 0, 'no nagging on open');
    await page.locator('#map canvas').focus(); for (let i = 0; i < 2; i++) await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(500);
    await press(page); await page.waitForFunction(() => !document.querySelector('#toast').hidden, null, { timeout: 15000 });
    assert.match(await page.locator('#toast').innerText(), /Location is off for Orient/);
    await page.waitForTimeout(500); assert.equal(Math.round((await where(page)).bearing), 0, 'north-up even without a location');
    assert.deepEqual(errors, []); await blocked.close();

    // 7. A brand-new map (no city chosen yet) does not ask for location on its own: it starts with Choose your city.
    const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['geolocation'], geolocation: HERE, serviceWorkers: 'block' });
    ({ page, errors } = await open(fresh, { seed: false })); await page.waitForTimeout(1500);
    assert.equal((await page.evaluate(() => window.__geo)).once, 0, 'no location request before a city is chosen');
    await fresh.close();

    // 8. The fog on My Map never covers you: a clear patch follows the dot (even with no saved places), and it is gone from other tabs.
    const fogCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['geolocation'], geolocation: HERE, serviceWorkers: 'block' });
    ({ page, errors } = await open(fogCtx)); await page.waitForFunction(() => OrientLocate.state().fix, null, { timeout: 15000 }); await settle(page);
    const hole = () => page.evaluate(() => {
      const fog = document.querySelector('#fog'), mask = fog.style.getPropertyValue('--fog-mask'), dot = document.querySelector('.you-marker').getBoundingClientRect(), box = fog.getBoundingClientRect();
      const at = [...mask.matchAll(/circle (\d+)px at (-?\d+)px (-?\d+)px/g)].map(m => ({ r: +m[1], x: +m[2], y: +m[3] }));
      return { n: at.length, dx: dot.x + dot.width / 2 - box.x, dy: dot.y + dot.height / 2 - box.y, at, opacity: fog.style.opacity };
    });
    await page.locator('[data-tab="Explore"]').click(); await page.waitForTimeout(300);
    assert.equal((await hole()).opacity, '0', 'no fog on Explore');
    await page.locator('[data-tab="My Map"]').click(); await page.waitForTimeout(500);
    let h = await hole(); assert.equal(h.opacity, '0.9', 'fog is on in My Map');
    assert.ok(h.at.some(c => Math.abs(c.x - h.dx) <= 2 && Math.abs(c.y - h.dy) <= 2 && c.r >= 165), 'a clear patch sits exactly on the dot: ' + JSON.stringify(h));
    await page.keyboard.press('ArrowRight'); await page.locator('#map canvas').focus(); for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight'); await page.waitForTimeout(900);
    h = await hole(); assert.ok(h.at.some(c => Math.abs(c.x - h.dx) <= 2 && Math.abs(c.y - h.dy) <= 2), 'the patch stays on the dot when the map is panned');
    await ctxSet(fogCtx, THERE); await press(page); await settle(page);
    h = await hole(); assert.ok(h.at.some(c => Math.abs(c.x - h.dx) <= 2 && Math.abs(c.y - h.dy) <= 2), 'and moves with it after the next compass press');
    assert.deepEqual(errors, []); await fogCtx.close();

    console.log('PASS Orient orients: locates on open and on every compass press, centres and turns north-up, still dot with accuracy ring, one request per ask and never a watch, memory only, yields to a map you are moving, explains a blocked location, silent on first run, fog on My Map always clear around the dot');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
