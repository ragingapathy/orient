// Open-format export: GeoJSON, CSV and GPX built on the device from the saved map.
//   ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node export-open-check.cjs
// Made-up places only. The neighbor guide must never appear in any file.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

const place = (id, name, i, extra = {}) => ({ id, name, kind: 'Cafe', icon: 'map-pin', coordinates: [-83.539 + i * 0.003, 41.655 + i * 0.001], address: i + ' Main St', note: '', demo: false, ...extra });
const custom = [
  place('local-a', 'Smith & Sons, "The Original"', 0, { note: 'Ask for Dee,\nsecond table' }),
  place('local-b', '=HYPERLINK("http://bad.example")', 1, { kind: 'Bookstore' }),
  place('local-c', 'Café Ñandú <3', 2),
];
const store = {
  version: 1, home: { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' }, useCatalog: false, custom, osm: [],
  saved: ['local-a', 'local-b', 'local-c'], visited: ['local-a'], visitLog: { 'local-a': ['2026-09-01', '2026-10-02T14:03:00.000Z'] },
  collections: [{ id: 'collection-x', name: 'Rainy-day refuges', description: '', places: ['local-a'] }],
  neighbors: [{ id: 'neighbor-1', name: 'Secret Neighbor', note: 'Private conversation about the fence' }],
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const open = async s => {
      const ctx = await browser.newContext({ viewport: { width: 1100, height: 860 }, acceptDownloads: true });
      await ctx.addInitScript(v => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(v)); } }, s);
      const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(e.message)); page.setDefaultTimeout(8000);
      await page.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' }));
      await page.goto(URL_); await page.waitForFunction(() => window.OrientOpenExport && document.querySelector('#open-export'), null, { timeout: 30000 });
      await page.click('[data-action="settings"]');
      return page;
    };
    const grab = async (page, fmt) => {
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-open-export="' + fmt + '"]')]);
      const file = await dl.path(); return { name: dl.suggestedFilename(), text: fs.readFileSync(file, 'utf8') };
    };
    const page = await open(store);

    await t('three buttons sit in Your data, beside the full export', async () => {
      assert.deepEqual(await page.locator('#open-export [data-open-export]').allInnerTexts(), ['GeoJSON', 'CSV', 'GPX']);
      assert.equal(await page.locator('#set-data [data-action="export"]').count(), 1, 'the full export is still there');
    });
    await t('GeoJSON has one point per place, longitude first, and no neighbors', async () => {
      const { name, text } = await grab(page, 'geojson');
      assert.match(name, /^orient-places-\d{4}-\d{2}-\d{2}\.geojson$/);
      const g = JSON.parse(text);
      assert.equal(g.type, 'FeatureCollection'); assert.equal(g.features.length, 3);
      const a = g.features[0]; assert.deepEqual(a.geometry.coordinates, [-83.539, 41.655]);
      assert.equal(a.properties.name, 'Smith & Sons, "The Original"'); assert.equal(a.properties.visits, 2); assert.equal(a.properties.last_visit, '2026-10-02');
      assert.deepEqual(a.properties.collections, ['Rainy-day refuges']); assert.equal(a.properties.note, 'Ask for Dee,\nsecond table');
      assert.equal(/Secret Neighbor|fence/.test(text), false, 'the neighbor guide stays out');
    });
    await t('CSV quotes commas, quotes and line breaks, and defuses spreadsheet formulas', async () => {
      const { name, text } = await grab(page, 'csv');
      assert.match(name, /\.csv$/); assert.ok(text.startsWith('﻿name,category,lat,lng'), 'a header, with a byte-order mark for spreadsheets');
      assert.ok(text.includes('"Smith & Sons, ""The Original"""'), 'commas and quotes are escaped');
      assert.ok(text.includes('"Ask for Dee,\nsecond table"'), 'a note with a line break stays in one cell');
      assert.ok(text.includes("\"'=HYPERLINK(\"\"http://bad.example\"\")\""), 'a leading = is neutralised');
      assert.equal(text.trim().split('\r\n').length - 1 >= 3, true);
      assert.equal(/Secret Neighbor|fence/.test(text), false);
    });
    await t('GPX is waypoints with the XML escaped', async () => {
      const { name, text } = await grab(page, 'gpx');
      assert.match(name, /\.gpx$/);
      const ok = await page.evaluate(x => { const d = new DOMParser().parseFromString(x, 'application/xml'); return { err: !!d.querySelector('parsererror'), count: d.getElementsByTagName('wpt').length, first: d.getElementsByTagName('name')[0].textContent, lat: d.getElementsByTagName('wpt')[0].getAttribute('lat') }; }, text);
      assert.deepEqual(ok, { err: false, count: 3, first: 'Smith & Sons, "The Original"', lat: '41.655' });
      assert.equal(/Secret Neighbor/.test(text), false);
    });
    await t('the status line says what was saved', async () => {
      assert.match(await page.locator('[data-open-export-status]').innerText(), /3 places saved as GPX/);
    });
    await t('an empty map says so and no mistake is thrown', async () => {
      const e = await open({ ...store, custom: [], saved: [], visited: [], visitLog: {}, collections: [] });
      const { text } = await grab(e, 'csv'); assert.equal(text.trim().split('\r\n').length, 1, 'just the header');
      assert.match(await e.locator('[data-open-export-status]').innerText(), /no places to export/);
      assert.deepEqual(e.errors, []);
    });
    assert.deepEqual(page.errors, []);
    console.log('PASS: ' + n + ' open export cases');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
