// Import from Google Takeout, end to end.  ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node takeout-check.cjs
// Uses made-up files in Google's export shapes and a stubbed place-name lookup. Nothing real, nothing online.
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
const pl = (id, name, lng, lat) => ({ id, name, kind: 'Food & drink', icon: 'coffee', coordinates: [lng, lat], address: 'Toledo, OH', note: '', demo: false });
const seed = { version: 1, custom: [pl('local-roast', 'Glass City Roasters', -83.5395, 41.6535), pl('local-franks', "Frank's Coffee", -83.55, 41.66)], osm: [], ratings: {}, saved: ['local-roast'], visited: [], drafts: {}, details: {}, events: [], showDemo: false, fog: false };

const CSV = 'Title,Note,URL,Tags,Comment\r\n'
  + '7 Brew Coffee,"best drive-thru, ask for ""the kind""",https://www.google.com/maps/place/7+Brew+Coffee/data=!4m2,,\r\n'
  + 'Glass City Metropark,,"https://www.google.com/maps/place/Glass+City+Metropark/@41.6511,-83.5342,17z/data=!3m1",,Great at dusk\r\n'
  + ',,https://www.google.com/maps/place/Toledo+Zoo/data=!4m2,,\r\n';
const GEO = { type: 'FeatureCollection', features: [
  { type: 'Feature', geometry: { type: 'Point', coordinates: [-83.55, 41.66] }, properties: { Title: "Frank's Coffee", Location: { Address: '1 Main St' } } },
  { type: 'Feature', geometry: { type: 'Point', coordinates: [-83.05, 42.33] }, properties: { Title: 'Detroit Diner', Location: { Address: 'Detroit' } } },
  { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { Title: 'Mystery spot', Location: {} } } ] };
const seg = (day, latLng) => ({ startTime: day + 'T09:00:00.000-04:00', endTime: day + 'T09:30:00.000-04:00', visit: { topCandidate: { placeLocation: { latLng } } } });
const TIMELINE = { semanticSegments: [seg('2026-09-20', '41.6535°, -83.5395°'), seg('2026-09-20', '41.6536°, -83.5396°'), seg('2026-09-22', '41.6535°, -83.5395°'), seg('2026-09-23', '41.5°, -83.9°'), { startTime: '2026-09-24T09:00:00.000-04:00', timelinePath: [] }] };
const file = (name, mimeType, body) => ({ name, mimeType, buffer: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
    await ctx.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } }, seed);
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    const asked = [];
    await page.route('**/api/geocode', async route => {
      const q = JSON.parse(route.request().postData()).query; asked.push(q);
      const hit = /7 Brew/.test(q) ? { name: '7 Brew Coffee', address: '100 Dorr St, Toledo, OH', coordinates: [-83.56, 41.65] } : /Zoo/.test(q) ? { name: 'Toledo Zoo', address: '2 Hippo Way, Toledo, OH', coordinates: [-83.5, 41.62] } : null;
      await route.fulfill({ json: { results: hit ? [hit] : [] } });
    });
    await page.goto(URL_); await page.waitForFunction(() => window.OrientTakeout && window.OrientVisits, null, { timeout: 20000 });

    await page.click('[data-action="settings"]');
    await page.setInputFiles('#takeout-file', [file('Want to go.csv', 'text/csv', CSV), file('Saved Places.json', 'application/json', GEO), file('Timeline.json', 'application/json', TIMELINE), file('notes.json', 'application/json', { a: 1 })]);
    await page.locator('#takeout-dialog[open]').waitFor();
    let text = await page.locator('#takeout-dialog').innerText();
    assert.match(text, /Want to go\s*3 places · 1 with a location/); assert.match(text, /Saved places\s*3 places · 2 with a location/);
    assert.match(text, /4 visits in the file/); assert.match(text, /notes\.json: I don’t recognise that file/);
    assert.match(text, /3 places have no location|have no location/);
    console.log('ok  files were read and described, and an unknown file was explained');

    await page.getByRole('button', { name: /Look up 3 by name/ }).click();
    await page.getByRole('button', { name: /Add \d+ places? to My Map/ }).waitFor({ timeout: 20000 });
    await page.waitForFunction(() => !/Looking up [0-9]+ of/.test(document.querySelector('#takeout-dialog').innerText), null, { timeout: 20000 });
    assert.equal(asked.length, 3, JSON.stringify(asked)); assert.ok(asked.some(q => /^7 Brew Coffee, Toledo, OH$/.test(q)), 'the lookup uses the name and the home city only');
    text = await page.locator('#takeout-dialog').innerText();
    assert.match(text, /Check 2 looked-up matches/);
    if (process.env.SHOT) await page.locator('#takeout-dialog').screenshot({ path: process.env.SHOT });
    // Frank's Coffee is already on the map, so it is not counted again: 7 Brew, Metropark, Zoo, Detroit Diner (exact location, so kept)
    assert.match(text, /Add 4 places to My Map/);
    console.log('ok  lookups sent only names; duplicates and unlocated places are not counted');

    await page.getByRole('button', { name: /Add 4 places to My Map/ }).click();
    await page.getByText(/Added 4 places and 2 visits to 1 place/).waitFor();
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('orient-field-map-v1')));
    const names = s.custom.map(p => p.name).sort();
    assert.deepEqual(names, ['7 Brew Coffee', 'Detroit Diner', 'Glass City Metropark', 'Glass City Roasters', "Frank's Coffee", 'Toledo Zoo'].sort());
    const brew = s.custom.find(p => p.name === '7 Brew Coffee');
    assert.equal(brew.kind, 'Food & drink'); assert.equal(brew.note, 'best drive-thru, ask for "the kind"'); assert.equal(brew.address, '100 Dorr St, Toledo, OH');
    assert.ok(s.saved.includes(brew.id)); assert.equal(s.custom.find(p => p.name === 'Glass City Metropark').kind, 'Public space');
    // two visits on two different days to Glass City Roasters (the second 09-20 entry is the same day), none for the far point
    assert.deepEqual(s.visitLog['local-roast'].slice().sort(), ['2026-09-20', '2026-09-22']);
    assert.equal(Object.keys(s.visitLog).length, 1);
    console.log('ok  places were added as saved places, and visits matched only the place on the map');

    // importing the same files again changes nothing
    await page.click('#takeout-dialog [data-tk="close"]'); await page.click('[data-action="settings"]');
    await page.setInputFiles('#takeout-file', [file('Want to go.csv', 'text/csv', CSV), file('Saved Places.json', 'application/json', GEO), file('Timeline.json', 'application/json', TIMELINE)]);
    await page.locator('#takeout-dialog[open]').waitFor();
    await page.getByRole('button', { name: /Look up/ }).click();
    await page.waitForFunction(() => !/Looking up [0-9]+ of/.test(document.querySelector('#takeout-dialog').innerText), null, { timeout: 20000 });
    await page.getByRole('button', { name: 'Add to My Map', exact: true }).click();
    await page.getByText(/Added 0 places/).waitFor();
    const s2 = await page.evaluate(() => JSON.parse(localStorage.getItem('orient-field-map-v1')));
    assert.equal(s2.custom.length, s.custom.length); assert.deepEqual(s2.visitLog['local-roast'].slice().sort(), ['2026-09-20', '2026-09-22']);
    console.log('ok  importing the same files twice adds nothing');

    assert.deepEqual(errors, [], errors.join(' | '));
    console.log('PASS: Google Takeout import');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
