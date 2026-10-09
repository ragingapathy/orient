// Browser check: log a visit each time you go. Seeds its own places (no catalog needed).
// Run against a running server:  ORIENT_URL=http://127.0.0.1:4173 node visits-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { chromium } = require((process.env.ORIENT_PLAYWRIGHT || 'playwright'));
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
const DAY = 86400000, now = Date.now();
const iso = ms => new Date(ms).toISOString();
const dayOnly = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const place = (id, name, lng, lat, kind = 'Coffee shop') => ({ id, name, kind, icon: 'coffee', coordinates: [lng, lat], address: 'Toledo, OH', note: '', demo: false });
const SEED = {
  version: 1, custom: [place('local-brew', '7 Brew', -83.55, 41.66), place('local-old', 'Old Haunt', -83.52, 41.64, 'Bar'), place('local-new', 'Newly Found', -83.5, 41.67)],
  osm: [], ratings: {}, saved: ['local-brew', 'local-old', 'local-new'], visited: ['local-old', 'local-brew'], drafts: {}, details: {}, events: [], showDemo: false, fog: true,
  // 7 Brew already has two visits (5 and 2 days ago). Old Haunt was only ever "marked visited" (from before dates were kept).
  visitLog: { 'local-brew': [iso(now - 5 * DAY), iso(now - 2 * DAY)] },
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await context.addInitScript(seed => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('orient-field-map-v1', JSON.stringify(seed)); sessionStorage.setItem('seeded', '1'); } }, SEED);
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => window.OrientVisits && document.querySelector('[data-tab="My Map"]'));
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('orient-field-map-v1')));
    const listView = async () => {
      await page.locator('.bottom-nav [data-tab="My Map"]').click();
      const sw = page.getByRole('button', { name: 'Switch to list', exact: true });
      if (await sw.count()) await sw.click();
    };
    const openPlace = async name => {
      await listView(); await page.locator('.row', { hasText: name }).first().click();
      // the card opens as a compact strip; tap its handle until the preview (with the bookmark and the check) shows
      for (let i = 0; i < 3 && !(await page.locator('#sheet .visit').isVisible()); i++) { await page.locator('#sheet .grip').click(); await page.waitForTimeout(450); }
      await page.locator('#sheet .visit').waitFor({ state: 'visible' });
    };
    const expand = async () => { if (!(await page.locator('.visit-history').count())) { await page.evaluate(() => document.querySelector('#sheet .expand')?.click()); await page.locator('.visit-history').waitFor(); } await page.evaluate(() => document.querySelector('.visit-history')?.setAttribute('open', '')); };

    // 1. migration: a place that was only marked visited counts once, date unknown; 7 Brew starts at 2
    let data = await stored();
    assert.deepEqual(data.visitLog['local-old'], [''], 'older visited marks become one undated visit');
    assert.equal(data.visitLog['local-brew'].length, 2);

    // 2. one tap logs a visit now, shows the count and an Undo; a second tap within 20 seconds is not counted
    await openPlace('7 Brew');
    assert.equal((await page.locator('#sheet .visit b').innerText()).trim(), '2');
    assert.match(await page.locator('#sheet .eventline').innerText(), /Been here 2 times/);
    await page.locator('#sheet .visit').click();
    assert.match(await page.locator('#toast').innerText(), /7 Brew: visit 3 logged · 3 in the last 14 days/);
    data = await stored();
    assert.equal(data.visitLog['local-brew'].length, 3);
    assert.match(data.visitLog['local-brew'][2], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'a tap records the time');
    assert.equal((await page.locator('#sheet .visit b').innerText()).trim(), '3');
    await page.locator('#sheet .visit').click();
    assert.match(await page.locator('#toast').innerText(), /Already logged a moment ago/);
    assert.equal((await stored()).visitLog['local-brew'].length, 3, 'a double tap counts once');

    // 3. Undo takes back the visit that was just logged, and only that one
    await page.locator('#toast .toast-undo').click();
    data = await stored();
    assert.equal(data.visitLog['local-brew'].length, 2);
    assert.deepEqual(data.visitLog['local-brew'], SEED.visitLog['local-brew']);
    assert.equal((await page.locator('#sheet .visit b').innerText()).trim(), '2');
    assert.equal(await page.locator('#toast').isVisible(), false);

    // 4. the history in the expanded card: remove a visit, add a past day, refuse a future day
    await expand();
    assert.equal(await page.locator('.visit-list li').count(), 2);
    const old = dayOnly(now - 20 * DAY);
    await page.locator('.visit-history [name=visit-date]').fill(old);
    await page.getByRole('button', { name: 'Add that day', exact: true }).click();
    data = await stored();
    assert.equal(data.visitLog['local-brew'].length, 3); assert.ok(data.visitLog['local-brew'].includes(old), 'a past visit is kept as a plain date');
    assert.equal(await page.locator('.visit-list li').count(), 3);
    await expand();
    await page.locator('.visit-history [name=visit-date]').fill(dayOnly(now + 3 * DAY));
    await page.getByRole('button', { name: 'Add that day', exact: true }).click();
    assert.match(await page.locator('#visit-add-status').innerText(), /has not happened yet/);
    assert.equal((await stored()).visitLog['local-brew'].length, 3);
    await page.locator('.visit-list li').last().locator('.visit-remove').click();     // the oldest: the 20 days ago one
    data = await stored();
    assert.equal(data.visitLog['local-brew'].length, 2); assert.ok(!data.visitLog['local-brew'].includes(old));
    await expand();
    await page.locator('.visit-history [name=visit-date]').fill(dayOnly(now - 60 * DAY));
    await page.getByRole('button', { name: 'Add that day', exact: true }).click();     // keep a 60 day old visit for the range test
    assert.equal((await stored()).visitLog['local-brew'].length, 3);

    // 5. Where you go: ranges, ranking, and the heat map toggle
    await listView();
    assert.equal(await page.locator('.visit-summary .chip.on').innerText(), '14 days');
    let summary = await page.locator('.visit-summary').innerText();
    assert.match(summary, /2 visits to 1 place in the last 14 days/); assert.match(summary, /7 Brew/); assert.doesNotMatch(summary, /Old Haunt/, 'an undated visit is not in a dated range');
    await page.locator('.visit-summary .chip', { hasText: '30 days' }).click();
    assert.equal((await stored()).visitDays, 30);
    assert.match(await page.locator('.visit-summary').innerText(), /2 visits to 1 place in the last 30 days/);
    await page.locator('.visit-summary .chip', { hasText: 'All time' }).click();
    summary = await page.locator('.visit-summary').innerText();
    assert.match(summary, /4 visits to 2 places so far/); assert.match(summary, /Old Haunt/); assert.match(summary, /3 visits/);
    await page.getByRole('button', { name: 'Show the heat map on the map', exact: true }).click();
    assert.equal((await stored()).heat, true);
    let st = await page.evaluate(() => OrientVisits.status());
    assert.equal(st.heat, true); assert.equal(st.features, 2); assert.equal(st.days, 0);
    const mapUp = await page.waitForFunction(() => { const s = document.querySelector('#map-status'); return !s || s.hidden; }, null, { timeout: 15000 }).then(() => true).catch(() => false);
    if (mapUp) { await page.waitForFunction(() => OrientVisits.status().layer, null, { timeout: 8000 }); }
    else console.log('note: the basemap did not load here, so the heat layer itself was not checked');
    await page.getByRole('button', { name: 'Hide the heat map', exact: true }).click();
    assert.equal((await stored()).heat, false);
    const weights = await page.evaluate(() => OrientVisits.heatData(14).features.map(f => [f.properties.id, f.properties.w]));
    assert.deepEqual(weights, [['local-brew', 2]]);
    await page.locator('.visit-summary .chip', { hasText: '14 days' }).click();

    // 6. an older "marked visited" place gets a second visit with the next tap; the list says so
    await openPlace('Old Haunt');
    assert.match(await page.locator('#sheet .eventline').innerText(), /Been here 1 time/);
    await page.locator('#sheet .visit').click();
    data = await stored();
    assert.equal(data.visitLog['local-old'].length, 2); assert.equal(data.visitLog['local-old'][0], '');
    await listView();
    assert.match(await page.locator('.row', { hasText: 'Old Haunt' }).last().innerText(), /Visited 2×/, 'the place list row shows the count');

    // 7. clearing all visits removes the visited mark, keeps the place and its bookmark
    await page.locator('.row', { hasText: 'Old Haunt' }).first().click();
    await expand();
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: 'Clear all visits to this place', exact: true }).click();
    data = await stored();
    assert.ok(!data.visitLog['local-old']); assert.ok(!data.visited.includes('local-old')); assert.ok(data.saved.includes('local-old')); assert.ok(data.custom.some(p => p.id === 'local-old'));

    // 8. a place you only saved: the first tap makes it visited; the bookmark still means "saved"
    await openPlace('Newly Found');
    assert.equal(await page.locator('#sheet .save').getAttribute('aria-pressed'), 'true');
    await page.locator('#sheet .visit').click();
    data = await stored();
    assert.equal(data.visitLog['local-new'].length, 1); assert.ok(data.visited.includes('local-new')); assert.ok(data.saved.includes('local-new'));
    await page.locator('#toast .toast-undo').click();
    data = await stored();
    assert.ok(!data.visitLog['local-new'] && !data.visited.includes('local-new'), 'undoing the only visit removes the visited mark');

    // 9. backups carry visits, and an imported backup is sanitized
    await page.getByRole('button', { name: 'Open settings', exact: true }).click();
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export my map', exact: true }).click();
    const exported = JSON.parse(fs.readFileSync(await (await dl).path(), 'utf8'));
    assert.equal(exported.visitLog['local-brew'].length, 3);
    const messy = { ...exported, visited: [...new Set([...exported.visited, 'local-new'])], visitLog: { 'local-brew': ['bogus', '2099-01-01', dayOnly(now - 3 * DAY), '', 5, null, iso(now - DAY)], 'not-a-place': [''] } };
    const file = path.join(os.tmpdir(), 'orient-visits-import.json'); fs.writeFileSync(file, JSON.stringify(messy));
    page.once('dialog', d => d.accept());
    await page.locator('#import-file').setInputFiles(file);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('orient-field-map-v1')).visitLog['local-new']);
    data = await stored();
    assert.deepEqual(data.visitLog['local-brew'], [dayOnly(now - 3 * DAY), '', iso(now - DAY)], 'invalid, future and non-text entries are dropped');
    assert.ok(!data.visitLog['not-a-place']);
    assert.deepEqual(data.visitLog['local-new'], [''], 'a backup that only marked a place visited counts it once');
    fs.rmSync(file, { force: true });
    try { await page.locator('[data-action="close-settings"]').click(); } catch { /* already closed */ }

    // 10. 320px: the check sits beside the bookmark without overflow
    await page.setViewportSize({ width: 320, height: 700 });
    await openPlace('7 Brew');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const box = await page.locator('#sheet .visit').boundingBox(); assert.ok(box.width >= 40 && box.height >= 40, 'touch target');
    assert.ok(await page.locator('#sheet .peekhead h2').isVisible());
    assert.deepEqual(errors, []);
    console.log('PASS: visits: migration, one-tap log with count, double-tap guard, undo, history (remove / add a past day / refuse future), ranges and ranking, heat map toggle and weights, older marks, clear, saved vs visited, backup and sanitizing import, 320px.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
