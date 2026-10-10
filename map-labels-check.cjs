// Names on the map pins and the desktop hover card.  ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node map-labels-check.cjs
// Made-up places only.
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
const C = [-83.539, 41.655];
const pl = (id, name, dx, dy, extra = {}) => ({ id, name, kind: 'Coffee shop', icon: 'coffee', coordinates: [C[0] + dx, C[1] + dy], address: '', note: '', demo: false, ...extra });
const seed = { version: 1, home: { name: 'Toledo', coordinates: C, timeZone: 'America/New_York' }, useCatalog: false,
  custom: [pl('local-roast', 'Glass City Roasters', 0, 0, { address: '1 Main St, Toledo, OH' }), pl('local-franks', 'Franks Coffee', 0.006, 0), pl('local-books', 'River Bench Books', 0.02, 0.004, { kind: 'Bookshop' }), pl('local-twin-a', 'Twin Cafe A', -0.01, 0.006), pl('local-twin-b', 'Twin Cafe B', -0.00995, 0.006)],
  osm: [], ratings: { 'local-roast': 5 }, saved: ['local-roast', 'local-franks'], visited: ['local-roast'], visitLog: { 'local-roast': [new Date().toISOString(), new Date(Date.now() - 3 * 864e5).toISOString()] },
  drafts: {}, details: { 'local-roast': { hours: 'Mon-Sun 12AM-11PM' } }, events: [], showDemo: false, fog: false };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const open = async (opts = {}) => {
      const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 }, ...opts });
      await ctx.addInitScript(s => {
        if (!sessionStorage.seeded) { sessionStorage.seeded = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); }
        let real; Object.defineProperty(window, 'maplibregl', { configurable: true, get() { return real; }, set(v) { real = v; const Orig = v.Map; v.Map = class extends Orig { constructor(...a) { super(...a); window.__m = this; } }; } });
      }, seed);
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.errors = errors;
      await page.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' }));
      await page.goto(URL_); await page.waitForFunction(() => window.__m && window.__m.loaded && window.OrientMapLabels && document.querySelector('.map-marker'), null, { timeout: 30000 });
      return page;
    };
    const zoomTo = async (page, z) => { await page.evaluate(zoom => new Promise(r => { __m.once('idle', () => setTimeout(r, 250)); __m.jumpTo({ center: [-83.539, 41.655], zoom }); }), z); };
    const shown = page => page.evaluate(() => [...document.querySelectorAll('.map-marker')].filter(m => m.querySelector('.pin-label.on')).map(m => m.querySelector('.pin-label').textContent));

    const page = await open();
    await zoomTo(page, 14);

    // 1. pins carry names, not categories
    const names = await page.evaluate(() => [...document.querySelectorAll('.pin-label')].map(l => l.textContent));
    assert.ok(names.includes('Glass City Roasters') && names.includes('River Bench Books'));
    assert.ok(!names.some(n => /Coffee shop|Bookshop/.test(n)), 'a label is the place name, never its category');
    assert.ok((await shown(page)).includes('Glass City Roasters'), 'the most important place gets its label');
    console.log('ok  pins are labelled with the place name, not the category');

    // 2. labels never sit on each other or on another pin; of two stacked places only one is named
    const geometry = await page.evaluate(() => {
      const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
      const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
      const markers = [...document.querySelectorAll('.map-marker')], on = markers.filter(m => m.querySelector('.pin-label.on'));
      const labels = on.map(m => ({ id: m.dataset.placeId, box: rect(m.querySelector('.pin-label')) })), pins = markers.map(m => ({ id: m.dataset.placeId, box: rect(m.querySelector('.pin')) }));
      let labelOnLabel = 0, labelOnPin = 0;
      labels.forEach((a, i) => { labels.slice(i + 1).forEach(b => { if (hit(a.box, b.box)) labelOnLabel++; }); pins.forEach(p => { if (p.id !== a.id && hit(a.box, p.box)) labelOnPin++; }); });
      return { labelOnLabel, labelOnPin, count: labels.length };
    });
    assert.equal(geometry.labelOnLabel, 0); assert.equal(geometry.labelOnPin, 0); assert.ok(geometry.count >= 2);
    const on = await shown(page); assert.equal(on.filter(n => /^Twin Cafe/.test(n)).length, 1, 'stacked places share one visible name: ' + on.join(', '));
    console.log('ok  no label overlaps another label or another pin; stacked places show one name');

    // 3. zoomed out, the map is not covered in text
    await zoomTo(page, 10); assert.deepEqual(await shown(page), [], 'no labels when zoomed far out');
    await zoomTo(page, 14); assert.ok((await shown(page)).length >= 2);
    console.log('ok  names appear from a close zoom and not before');

    // 4. the selected place is always named, even if something more important is nearby
    await page.locator('.map-marker[data-place-id="local-twin-b"]').click({ force: true });
    await page.waitForTimeout(300);
    const selectedName = await page.evaluate(() => { const m = document.querySelector('.map-marker[aria-pressed=true]'); return m && m.querySelector('.pin-label.on') ? m.querySelector('.pin-label').textContent : null; });
    assert.match(selectedName || '', /^Twin Cafe/, 'whichever stacked place was selected keeps its name');

    // 5. hovering shows a card with what matters, and leaving hides it
    await page.keyboard.press('Escape');
    const roast = page.locator('.map-marker[data-place-id="local-roast"]');
    await roast.hover({ force: true });
    await page.locator('#hover-card').waitFor({ state: 'visible' });
    const card = await page.locator('#hover-card').innerText();
    assert.match(card, /Glass City Roasters/); assert.match(card, /Coffee shop · Saved/); assert.match(card, /1 Main St, Toledo, OH/);
    assert.match(card, /(Open|Closed) now/); assert.match(card, /Been here 2 times/); assert.match(card, /Click for details/);
    const inside = await page.evaluate(() => { const c = document.querySelector('#hover-card').getBoundingClientRect(), m = document.querySelector('#map').getBoundingClientRect(); return c.left >= m.left && c.right <= m.right && c.top >= m.top && c.bottom <= m.bottom; });
    assert.equal(inside, true, 'the card stays inside the map');
    assert.equal(await page.locator('#hover-card').evaluate(e => getComputedStyle(e).pointerEvents), 'none');
    await page.mouse.move(5, 700); await page.locator('#hover-card').waitFor({ state: 'hidden', timeout: 2000 });
    console.log('ok  hovering a pin shows its name, type, hours, address and visits; moving away hides it');

    // 6. Escape and panning dismiss it; another pin replaces it
    await roast.hover({ force: true }); await page.locator('#hover-card').waitFor({ state: 'visible' }); await page.keyboard.press('Escape'); await page.locator('#hover-card').waitFor({ state: 'hidden' });
    await page.locator('.map-marker[data-place-id="local-franks"]').hover({ force: true }); await page.waitForFunction(() => /Franks Coffee/.test(document.querySelector('#hover-card')?.innerText || ''));
    console.log('ok  Escape dismisses the card and a different pin shows its own');

    // 7. a touch device gets names but no hover card
    const touch = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await zoomTo(touch, 14);
    assert.ok((await shown(touch)).includes('Glass City Roasters'));
    await touch.evaluate(() => document.querySelector('.map-marker[data-place-id="local-roast"]').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    await touch.waitForTimeout(400);
    assert.equal(await touch.evaluate(() => { const c = document.querySelector('#hover-card'); return !c || c.hidden || getComputedStyle(c).display === 'none'; }), true);
    console.log('ok  on a touch screen names show and the hover card does not');

    assert.deepEqual([...page.errors, ...touch.errors], [], page.errors.concat(touch.errors).join(' | '));
    console.log('PASS: map names and the hover card');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
