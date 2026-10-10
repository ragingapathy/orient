// "Your map so far": the numbers, and the drawer on My Map.  ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node insights-check.cjs
// Made-up maps only. Nothing real is read and nothing leaves the page.
const assert = require('node:assert/strict');
const I = require('./public/insights.js');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

// ---------- the numbers ----------
const NOW = new Date('2026-10-10T16:00:00Z'), TZ = 'America/New_York'; // Saturday 12:00 in New York
const who = { a: { name: 'Alpha Cafe', kind: 'Coffee shop' }, b: { name: 'Beta Books', kind: 'Bookshop' }, c: { name: 'Gamma Park', kind: 'Public space' }, d: { name: 'Delta Diner', kind: 'Food & drink' } };
const lookup = id => who[id] || null;
const base = () => ({ home: { timeZone: TZ }, visited: ['a', 'b', 'c'], saved: ['a', 'b', 'c', 'd'], ratings: { a: 5, b: 5, c: 3 }, custom: [], details: {} });
const run = (s, o = {}) => I.compute(s, { now: NOW, lookup, ...o });

(async () => {
  await t('weekdays and dates follow the home time zone; plain days do not move', () => {
    const s = { ...base(), visitLog: { a: ['2026-09-06T02:00:00Z', '2026-09-05'], b: ['2026-09-06T23:30:00Z'] } };
    const r = run(s);
    assert.equal(I.entry('2026-09-06T02:00:00Z', TZ).day, '2026-09-05', 'late on the 5th in New York, not the 6th');
    assert.equal(I.entry('2026-09-06T02:00:00Z', TZ).dow, 6); assert.equal(I.entry('2026-09-05', TZ).dow, 6); assert.equal(I.entry('2026-09-06T23:30:00Z', TZ).dow, 0);
    assert.equal(r.weekday[6], 2); assert.equal(r.weekday[0], 1); assert.equal(r.topDowName, 'Saturdays');
  });
  await t('a tie for the busiest day goes to the earlier day of the week, and no dates means no claim', () => {
    const r = run({ ...base(), visitLog: { a: ['2026-10-05', '2026-10-06'] } }); assert.equal(r.topDowName, 'Mondays');
    const none = run({ ...base(), visitLog: {}, visited: ['a'] }); assert.equal(none.topDow, null); assert.equal(none.total, 1); assert.equal(none.undatedVisits, 1);
  });
  await t('totals, to-try, coverage, this week and the last 30 days', () => {
    const r = run({ ...base(), visitLog: { a: ['2026-10-09T14:00:00Z', '2026-10-04', '2026-09-20'], b: ['2026-08-01'], c: [''] } });
    assert.equal(r.total, 5); assert.equal(r.placesVisited, 3); assert.equal(r.toTry, 1); assert.equal(r.coverage, 75);
    assert.equal(r.last7, 2, 'Oct 9 and Oct 4 are within a week of Oct 10'); assert.equal(r.last30, 3);
    assert.equal(r.newRecent, 1, 'Alpha was first visited on 2026-09-20, 20 days ago; Beta was last visited in August');
  });
  await t('new versus returning in the last 30 days', () => {
    const r = run({ ...base(), visitLog: { a: ['2026-10-02', '2026-10-08'], b: ['2026-07-01', '2026-10-05'], c: ['2026-09-28'] } });
    assert.equal(r.newRecent, 2, 'Alpha and Gamma were first visited in the window'); assert.equal(r.returningRecent, 1, 'Beta was first visited long ago');
  });
  await t('regulars are ranked by visits, then rating, and five-star places are listed', () => {
    const r = run({ ...base(), visitLog: { a: ['2026-10-01', '2026-10-02', '2026-10-03'], b: ['2026-10-01', '2026-10-02', '2026-10-03'], c: ['2026-10-01'] } });
    assert.deepEqual(r.regulars.map(x => x.name), ['Alpha Cafe', 'Beta Books', 'Gamma Park'], 'a tie on visits falls back to rating, then name'); assert.equal(r.regulars[0].last, '2026-10-03');
    assert.deepEqual(r.loved, ['Alpha Cafe', 'Beta Books']);
    assert.deepEqual(r.kinds.map(k => k.kind), ['Coffee shop', 'Bookshop', 'Public space']);
  });
  await t('what you are building counts each thing once', () => {
    const s = { ...base(), custom: [{ id: 'x', name: 'X', note: 'hello' }, { id: 'y', name: 'Y', note: '', photoMemory: {} }, { id: 'z', name: 'Z' }], details: { x: { note: 'also here' }, a: { note: 'a note' }, b: { note: '   ' } },
      photos: { a: [1, 2], b: [3] }, circuits: [{}, {}], events: [{}], journey: { earned: { m1: '2026-09-01' } },
      commons: { records: [{ localPlaceId: 'a' }, { localPlaceId: 'a' }, { localPlaceId: 'b' }] } };
    const b = run(s).building;
    assert.deepEqual(b, { placesAdded: 2, photoMemories: 1, photos: 3, notes: 2, ratings: 3, circuits: 2, calendarEntries: 1, shared: 3, sharedPlaces: 2, milestones: 1 });
  });
  await t('a year ago today: the same date, else the same few days, and never a bad date', () => {
    const exact = run({ ...base(), visitLog: { a: ['2025-10-10T15:00:00Z'], b: ['2024-10-10', '2024-10-10T18:00:00Z'] } });
    assert.deepEqual(exact.ago.map(a => [a.yearsAgo, a.exact, a.places.join('+')]), [[1, true, 'Alpha Cafe'], [2, true, 'Beta Books']]);
    const near = run({ ...base(), visitLog: { c: ['2025-10-12'] } }); assert.equal(near.ago[0].exact, false); assert.equal(near.ago[0].places[0], 'Gamma Park');
    assert.deepEqual(run({ ...base(), visitLog: { c: ['2025-06-12'] } }).ago, []);
    const leap = I.compute({ ...base(), visitLog: { a: ['2024-02-29'] } }, { now: new Date('2026-02-28T17:00:00Z'), lookup }); assert.ok(Array.isArray(leap.ago));
  });
  await t('the year in review, for each year that has visits', () => {
    const r = run({ ...base(), visitLog: { a: ['2025-03-01', '2025-03-08', '2025-04-05', '2026-01-04'], b: ['2026-01-04', '2026-02-07', '2026-02-14'], c: ['2026-02-21'] } });
    assert.deepEqual(Object.keys(r.years).sort().reverse(), ['2026', '2025']);
    const y = r.years[2026]; assert.equal(y.visits, 5); assert.equal(y.places, 3); assert.equal(y.newPlaces, 2, 'Beta and Gamma are new in 2026; Alpha began in 2025');
    assert.equal(y.favourite.name, 'Beta Books'); assert.equal(y.busiestMonth, 'February'); assert.equal(y.weekday, 'Saturdays'); assert.equal(y.firstVisit.day, '2026-01-04'); assert.equal(y.activeDays, 4);
    assert.equal(r.years[2025].newPlaces, 1);
  });
  await t('the twelve-week grid starts on a Monday, ends this week, and blanks the future', () => {
    const r = run({ ...base(), visitLog: { a: ['2026-10-10', '2026-10-10T20:00:00Z', '2026-10-05'] } });
    assert.equal(r.grid.length, 12); assert.ok(r.grid.every(c => c.length === 7)); assert.equal(r.grid[0][0].day, '2026-07-20'); assert.equal(I.parts(new Date('2026-07-20T12:00:00Z'), 'UTC').dow, 1);
    const last = r.grid[11]; assert.equal(last[0].day, '2026-10-05'); assert.equal(last[5].day, '2026-10-10'); assert.equal(last[5].count, 2); assert.equal(last[6].count, null, 'Sunday has not happened yet');
    assert.equal(r.monthly.length, 12); assert.equal(r.monthly[11].key, '2026-10'); assert.equal(r.monthly[0].key, '2025-11');
  });
  await t('an empty map, a missing map and junk entries do not throw', () => {
    for (const s of [null, undefined, {}, { visitLog: { a: ['nonsense', 42, null, ''] } }, { visited: ['q'], visitLog: 'bad', saved: 'bad', custom: 'bad', commons: { records: 'bad' } }]) { const r = run(s); assert.equal(typeof r.total, 'number'); assert.ok(r.grid.length === 12); }
    assert.equal(run({}).total, 0);
  });

  // ---------- the drawer ----------
  const DAY = 864e5, now = Date.now();
  const iso = (daysBack, hour = 10) => { const d = new Date(now - daysBack * DAY); d.setUTCHours(hour, 15, 0, 0); return d.toISOString(); };
  const names = ['Glass City Roasters', 'River Bench Books', 'Corner Pantry', 'Freedom Comics', 'Metropark Trail', 'Old Bag of Nails'];
  const custom = names.map((name, i) => ({ id: 'local-p' + i, name, kind: ['Coffee shop', 'Bookshop', 'Food pantry', 'Comic shop', 'Public space', 'Pub'][i], icon: 'map-pin', coordinates: [-83.539 + i * 0.002, 41.655], address: i + ' Main St', note: '', demo: false }));
  const seed = { version: 1, home: { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' }, useCatalog: false, custom, osm: [], saved: [...custom.map(p => p.id), ], visited: custom.slice(0, 5).map(p => p.id),
    visitLog: { 'local-p0': [iso(1), iso(8), iso(15), iso(365), iso(40, 18)], 'local-p1': [iso(2), iso(9), iso(60)], 'local-p2': [iso(5)], 'local-p3': [iso(20), iso(100)], 'local-p4': [iso(3)] },
    ratings: { 'local-p0': 5, 'local-p1': 4 }, drafts: {}, details: { 'local-p0': { note: 'Quiet mornings.' } }, events: [], showDemo: false, fog: false,
    commons: { publisher: null, records: [{ source: { id: 's', name: 'S', license: 'CC-BY-4.0' }, place: { source_id: 's', id: 'p', name: 'x', coordinates: [-83.5, 41.6] }, claim: { schema_version: 1, id: 'c1', place_id: 'p', kind: 'seating', observation: 'Seats.', source: { type: 'personal_observation' }, asserted_on: '2026-10-01', status: 'active' }, localPlaceId: 'local-p0' }] } };
  const expected = I.compute(seed, { lookup: id => custom.find(p => p.id === id) || null });

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const open = async (store, opts = {}) => {
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 840 }, ...opts });
      const requests = []; ctx.on('request', r => requests.push(r.url()));
      await ctx.addInitScript(s => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); } }, store);
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.errors = errors; page.requests = requests;
      await page.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' }));
      await page.goto(URL_); await page.waitForFunction(() => window.OrientInsights && document.querySelector('.map-marker, #insights'), null, { timeout: 30000 });
      return page;
    };
    const visible = p => p.locator('#insights').isVisible().catch(() => false);
    const page = await open(seed);

    await t('the drawer appears on My Map only, closed to start with, with a one-line summary', async () => {
      await page.waitForTimeout(500); assert.equal(await visible(page), false, 'not on Explore');
      await page.click('.bottom-nav [data-tab="My Map"]'); await page.locator('#insights:not([hidden])').waitFor();
      assert.equal(await page.locator('#insights .ins-head').getAttribute('aria-expanded'), 'false'); assert.equal(await page.locator('#insights .ins-body').isVisible(), false);
      assert.match(await page.locator('#insights .ins-title').innerText(), new RegExp('Your map so far[\\s\\S]*' + expected.placesVisited + ' places visited'));
      await page.click('.bottom-nav [data-tab="Calendar"]'); await page.waitForTimeout(300); assert.equal(await visible(page), false, 'not on Calendar');
      await page.click('.bottom-nav [data-tab="My Map"]'); await page.locator('#insights:not([hidden])').waitFor();
    });
    await t('it steps aside for the list and for a selected place, and comes back', async () => {
      await page.locator('[data-action="list"]:visible').first().click(); await page.waitForTimeout(400); assert.equal(await visible(page), false, 'hidden while the list is open');
      await page.click('.bottom-nav [data-tab="My Map"]'); await page.locator('#insights:not([hidden])').waitFor(); // the My Map tab returns to the map
      await page.locator('.map-marker').first().click({ force: true }); await page.waitForTimeout(500); assert.equal(await visible(page), false, 'hidden while a place card is open');
      await page.click('.bottom-nav [data-tab="Explore"]'); await page.click('.bottom-nav [data-tab="My Map"]'); await page.locator('#insights:not([hidden])').waitFor();
    });
    await t('opened, it shows every section with the numbers from this map', async () => {
      await page.click('#insights .ins-head'); await page.waitForTimeout(1200);
      const text = await page.locator('#insights').innerText();
      for (const s of ['Your rhythm', 'Your regulars', 'How you explore', 'What you are building', 'Your year in Orient', 'A year ago today']) assert.match(text, new RegExp(s, 'i'), s);
      const hero = await page.locator('.ins-hero b').allInnerTexts(); assert.deepEqual(hero.map(Number), [expected.placesVisited, expected.total, expected.toTry, expected.building.shared]);
      assert.match(text, new RegExp(expected.topDowName + ' are your day')); assert.equal(await page.locator('.ins-bar.top').count(), 1);
      const regulars = await page.locator('.ins-regulars strong').allInnerTexts(); assert.deepEqual(regulars, expected.regulars.map(r => r.name)); assert.equal(regulars[0], 'Glass City Roasters');
      assert.match(await page.locator('.ins-ago').innerText(), /A year ago you went to Glass City Roasters/);
      assert.equal(await page.locator('.ins-grid i').count(), 84);
      assert.equal(await page.locator('#insights .ins-body').evaluate(e => e.scrollHeight > e.clientHeight), true, 'the body scrolls');
      const box = await page.locator('#insights').boundingBox(), vp = page.viewportSize(); assert.ok(box.y >= 0 && box.y + box.height <= vp.height);
    });
    await t('the year card switches years and copies a plain-text summary', async () => {
      const years = await page.locator('[data-ins-year]').allInnerTexts(); assert.deepEqual(years, Object.keys(expected.years).sort().reverse());
      const first = await page.locator('.ins-year .ins-headline').innerText(); await page.locator('[data-ins-year]').nth(1).click();
      assert.notEqual(await page.locator('.ins-year .ins-headline').innerText(), first); assert.equal(await page.locator('.ins-bignum b').innerText(), years[1]);
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.locator('[data-ins-year]').nth(0).click(); await page.locator('[data-ins-copy]').click(); await page.getByText('Copied.').waitFor();
      const copied = await page.evaluate(() => navigator.clipboard.readText()); assert.match(copied, new RegExp('My ' + years[0] + ' in Orient')); assert.match(copied, /Most visited: Glass City Roasters/);
    });
    await t('it remembers being open, and refreshes when the map changes', async () => {
      await page.reload(); await page.waitForFunction(() => window.OrientInsights); await page.click('.bottom-nav [data-tab="My Map"]'); await page.locator('#insights:not([hidden])').waitFor();
      assert.equal(await page.locator('#insights .ins-head').getAttribute('aria-expanded'), 'true', 'still open after a reload');
      assert.equal(Number(await page.locator('.ins-hero b').nth(1).getAttribute('data-count')), expected.total); const before = expected.total;
      await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('orient-field-map-v1')); s.visitLog['local-p5'] = [new Date().toISOString()]; s.visited.push('local-p5'); localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); });
      await page.click('.bottom-nav [data-tab="Explore"]'); await page.click('.bottom-nav [data-tab="My Map"]'); await page.locator('#insights:not([hidden])').waitFor(); await page.waitForTimeout(1100);
      assert.equal(Number(await page.locator('.ins-hero b').nth(1).getAttribute('data-count')), before + 1); assert.equal(Number(await page.locator('.ins-hero b').nth(0).getAttribute('data-count')), expected.placesVisited + 1);
    });
    await t('nothing leaves the page: no requests beyond this site and its map tiles', async () => {
      const foreign = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1|http:\/\/localhost|data:|blob:)/.test(u) && !/openfreemap\.org|tiles\./.test(u));
      assert.deepEqual(foreign, []);
      assert.deepEqual(page.errors, [], page.errors.join(' | '));
    });

    await t('a brand-new map leaves the screen to the app’s welcome; saved places with no visits get an invitation, not a wall of zeros', async () => {
      const blank = await open({ version: 1, home: seed.home, useCatalog: false, custom: [], osm: [], saved: [], visited: [] });
      await blank.click('.bottom-nav [data-tab="My Map"]'); await blank.waitForTimeout(900);
      assert.equal(await visible(blank), false, 'the welcome panel owns an empty My Map'); assert.deepEqual(blank.errors, []);
      const early = await open({ ...seed, visited: [], visitLog: {}, ratings: {}, commons: { publisher: null, records: [] } });
      await early.click('.bottom-nav [data-tab="My Map"]'); await early.locator('#insights:not([hidden])').waitFor();
      assert.match(await early.locator('#insights .ins-title').innerText(), /0 places visited|to try/); await early.click('#insights .ins-head');
      const text = await early.locator('#insights').innerText();
      assert.match(text, /Ready when you are/); assert.match(text, /what you are building/i); assert.equal(await early.locator(".ins-bars, .ins-regulars, .ins-year, .ins-grid").count(), 0, "the sections with nothing to say are not drawn");
      assert.equal(await early.locator('.ins-hero').count(), 0); assert.deepEqual(early.errors, []);
    });
    await t('on a phone the drawer sits at the bottom, opens to most of the screen, and scrolls inside', async () => {
      const phone = await open(seed, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await phone.click('.bottom-nav [data-tab="My Map"]'); await phone.locator('#insights:not([hidden])').waitFor(); await phone.click('#insights .ins-head'); await phone.waitForTimeout(900);
      const box = await phone.locator('#insights').boundingBox(); assert.ok(box.width >= 388 && box.height > 400 && box.height < 700 && box.y > 60);
      assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
      assert.equal(await phone.locator('#insights .ins-body').evaluate(e => e.scrollHeight > e.clientHeight), true); assert.deepEqual(phone.errors, []);
    });
    await t('with reduced motion the numbers are final at once', async () => {
      const calm = await open(seed, { reducedMotion: 'reduce' });
      await calm.click('.bottom-nav [data-tab="My Map"]'); await calm.locator('#insights:not([hidden])').waitFor(); await calm.click('#insights .ins-head');
      assert.equal(Number(await calm.locator('.ins-hero b').nth(0).innerText()), expected.placesVisited, 'no counting up');
      assert.equal(await calm.locator('.ins-bar i').first().evaluate(e => getComputedStyle(e).animationName), 'none');
    });
    console.log('PASS: ' + n + ' insights cases');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
