// A normal Orient install has no Silverbook: nothing about it is drawn, nothing looks for it, and what a place already has
// stored under silverbookIds is left alone. (The integration itself is covered by silverbook-check and silverbook-ui-check.)
const assert = require('node:assert/strict'), { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const base = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
    // A place that still carries a link from before, so we can see it is neither shown nor erased.
    await page.addInitScript(() => { if (sessionStorage.getItem('fixture')) return; sessionStorage.setItem('fixture', '1');
      localStorage.setItem('orient-field-map-v1', JSON.stringify({ version: 1, home: { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' }, useCatalog: false, custom: [{ id: 'local-cafe', name: 'Lantern Café', coordinates: [-83.539, 41.655], kind: 'Food & drink' }], saved: ['local-cafe'], fog: true, details: { 'local-cafe': { silverbookIds: ['maya'] } } })); });
    // The server answers plainly that it is off, and never reaches for Silverbook's port.
    const answer = await (await page.request.get(base + '/api/silverbook')).json();
    assert.deepEqual(answer, { enabled: false }, 'the bridge says it is off');
    await page.goto(base); await page.waitForFunction(() => window.OrientSilverbook && document.querySelector('.map-marker'));
    assert.equal(await page.evaluate(() => OrientSilverbook.data().enabled), false);
    assert.deepEqual(await page.evaluate(() => OrientSilverbook.chips(['maya'])), [], 'no names are drawn');
    await page.locator('.map-marker[aria-label^="Lantern"]').click(); await page.locator('.grip').press('End');
    await page.locator('details.place-knowledge summary').click();
    assert.ok(!/silverbook/i.test(await page.locator('.place-knowledge').innerText()), 'the place card never mentions Silverbook');
    await page.getByRole('button', { name: 'Edit place details', exact: true }).click();
    await page.locator('#knowledge-dialog form').waitFor();
    assert.equal(await page.locator('[data-silverbook-card]').count(), 0, 'no With · Silverbook card in the details dialog');
    assert.ok(!/silverbook/i.test(await page.locator('#knowledge-dialog').innerText()), 'the dialog never mentions Silverbook');
    // Saving place details must not wipe an old link just because the feature is off.
    await page.getByRole('button', { name: 'Save place details', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('orient-field-map-v1')).details['local-cafe'].silverbookIds), ['maya'], 'stored links are kept');
    // The whole app, anywhere: no visible mention.
    assert.ok(!/silverbook/i.test(await page.evaluate(() => document.body.innerText)), 'no visible Silverbook text anywhere');
    assert.deepEqual(errors, []);
    console.log('PASS Silverbook is invisible on a normal install: the bridge says it is off, no card, no names, no text anywhere, and stored links are kept');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
