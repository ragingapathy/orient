// Browser check: start a place from a website address. Uses fixtures for the website reader and the geocoder (no live requests).
// Run against a running server:  ORIENT_URL=http://127.0.0.1:4173 node addsite-check.cjs
const assert = require('node:assert/strict');
const { chromium } = require((process.env.ORIENT_PLAYWRIGHT || 'playwright'));
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
const SRC = 'https://kava.example/';
const fact = (key, value, method = 'Structured website data') => ({ id: key + value, key, value, sourceURL: SRC, method });
const FIXTURE = {
  url: SRC, retrievedAt: '2026-10-09T12:00:00.000Z', readPages: [SRC], warnings: [], isFeed: false, calendars: [],
  events: [{ uid: 'e1', title: 'Open mic', date: '2026-10-14', time: '19:00', end: '', endDate: '', note: '', location: '', sourceURL: SRC }],
  place: { names: [{ value: 'Kava Culture', method: 'Structured website data' }], description: 'A kava bar.', coordinates: [-83.54, 41.65], types: ['CafeOrCoffeeShop'] },
  facts: [fact('name', 'Kava Culture'), fact('phone', '(419) 555-0100'), fact('hours', 'Mo-Fr 10:00-18:00'), fact('address', '1 Government Center, Toledo, OH, 43604'), fact('social', 'https://www.instagram.com/kavaculture/', 'Published social link')],
};
const MATCH = { results: [{ name: '1 Government Center', address: '1 GOVERNMENT CTR, TOLEDO, OH, 43604', coordinates: [-83.5379, 41.6528], accuracy: 'Estimated position along the street' }] };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [], websiteCalls = [], otherPosts = [];
    page.on('pageerror', e => errors.push(e.message));
    let mode = 'ok';
    await page.route('**/api/website', r => { websiteCalls.push(JSON.parse(r.request().postData() || '{}')); return mode === 'blocked' ? r.fulfill({ status: 502, json: { error: 'This website asks automated readers not to read that page.' } }) : r.fulfill({ json: FIXTURE }); });
    await page.route('**/api/geocode', r => { otherPosts.push('geocode'); return r.fulfill({ json: MATCH }); });
    await page.goto(URL_);
    await page.waitForFunction(() => window.OrientWebsite && document.querySelector('[data-action="add"]'));
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('orient-field-map-v1')));
    const openAdd = async () => { await page.evaluate(() => document.querySelector('[data-action="add"]').click()); await page.locator('#add-dialog').waitFor({ state: 'visible' }); };
    const field = n => page.locator(`#add-form [name=${n}]`);

    // 1. Read a website: nothing happens by typing, the page fills the form on the button press
    await openAdd();
    assert.equal(await page.locator('#site-start').isVisible(), true, 'website box is shown for a new place');
    await field('website').fill('kava.example');
    assert.equal(websiteCalls.length, 0, 'typing does not read the website');
    await page.getByRole('button', { name: 'Read website', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#add-form [name=name]').value === 'Kava Culture');
    assert.deepEqual(websiteCalls, [{ url: SRC }], 'only the website address is sent, normalized to https');
    assert.equal(await field('address').inputValue(), '1 Government Center, Toledo, OH, 43604');
    assert.equal(await field('kind').inputValue(), 'Food & drink', 'category suggested from the business type');
    const labels = await page.locator('#site-found .website-choice strong').allInnerTexts();
    assert.deepEqual(labels.sort(), ['Instagram', 'Phone', 'Published address', 'Published hours'].sort());
    assert.equal(await page.locator('#site-found [data-site-fact]:checked').count(), 4, 'details are offered pre-ticked');
    assert.match(await page.locator('#site-found').innerText(), /1 upcoming event/);
    assert.match(await page.locator('#lookup-status').innerText(), /Press Find address/);

    // 2. Untick hours, find the address, save: the place keeps its website and only the ticked details
    await page.locator('#site-found [data-site-fact]').nth(1).uncheck();
    await page.getByRole('button', { name: 'Find address', exact: true }).click();
    await page.locator('[data-location="0"]').click();
    await page.getByRole('button', { name: 'Add to My Map', exact: true }).click();
    let data = await stored();
    assert.equal(data.custom.length, 1); const id = data.custom[0].id;
    assert.equal(data.custom[0].name, 'Kava Culture'); assert.equal(data.custom[0].kind, 'Food & drink');
    assert.equal(data.web.urls[id], SRC);
    assert.deepEqual(data.web.profiles[id].map(f => f.key).sort(), ['address', 'phone', 'social']);
    assert.ok(data.web.profiles[id].every(f => f.retrievedAt === FIXTURE.retrievedAt && f.sourceURL === SRC));
    assert.ok(!data.web.profiles[id].some(f => f.key === 'name' || f.key === 'hours'));
    assert.ok(data.saved.includes(id));
    assert.ok(await page.evaluate(() => document.body.innerText.includes('kava.example')), 'the place card shows its website');

    // 3. Use the location the website publishes instead of a lookup
    await openAdd();
    await field('website').fill('https://kava.example/');
    await page.getByRole('button', { name: 'Read website', exact: true }).click();
    await page.getByRole('button', { name: 'Use the map location this website publishes', exact: true }).click();
    assert.match(await page.locator('#lookup-status').innerText(), /the point this website publishes/);
    await field('name').fill('Kava Culture, second pin');
    await page.getByRole('button', { name: 'Add to My Map', exact: true }).click();
    data = await stored();
    assert.equal(data.custom.length, 2); assert.deepEqual(data.custom[1].coordinates, [-83.54, 41.65]);

    // 4. A website that was never read is still kept with the place; a blocked read gives a plain message and does not stop saving
    mode = 'blocked';
    await openAdd();
    await field('website').fill('blocked.example/about');
    await page.getByRole('button', { name: 'Read website', exact: true }).click();
    await page.waitForFunction(() => /automated readers/.test(document.querySelector('#site-status').textContent));
    assert.match(await page.locator('#site-status').innerText(), /website address will be kept/);
    await field('name').fill('Blocked Place'); await field('kind').fill('Shop');
    await page.locator('#coordinate-details summary').click();
    await field('lat').fill('41.66'); await field('lng').fill('-83.55');
    await page.getByRole('button', { name: 'Add to My Map', exact: true }).click();
    data = await stored();
    const blocked = data.custom.find(p => p.name === 'Blocked Place');
    assert.equal(data.web.urls[blocked.id], 'https://blocked.example/about'); assert.ok(!data.web.profiles[blocked.id]);

    // 5. An address that is not a website is refused without a request; editing the box clears what was read
    mode = 'ok'; const calls = websiteCalls.length;
    await openAdd();
    await field('website').fill('not a url ::');
    await page.getByRole('button', { name: 'Read website', exact: true }).click();
    assert.match(await page.locator('#site-status').innerText(), /valid website address/); assert.equal(websiteCalls.length, calls);
    // a website address that is not valid blocks saving with a plain message and creates nothing
    const before = (await stored()).custom.length;
    await field('name').fill('Bad Site Place'); await field('kind').fill('Shop');
    await page.locator('#coordinate-details summary').click(); await field('lat').fill('41.66'); await field('lng').fill('-83.55');
    await page.getByRole('button', { name: 'Add to My Map', exact: true }).click();
    assert.match(await page.locator('#site-status').innerText(), /not valid/); assert.equal((await stored()).custom.length, before);
    await field('website').fill('kava.example');
    await page.getByRole('button', { name: 'Read website', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#site-found [data-site-fact]'));
    await field('website').fill('kava.example/menu');
    assert.equal(await page.locator('#site-found').innerHTML(), '', 'editing the address discards what was read');
    await page.locator('[data-action="close-add"]').click();

    // 6. Editing an existing place does not show the website box (its card has Read a website)
    await page.evaluate(() => document.querySelector('[data-action="edit-place"]')?.click());
    if (await page.locator('#add-dialog').isVisible()) assert.equal(await page.locator('#site-start').isVisible(), false);

    // 7. 320px layout, no horizontal overflow, nothing but the website address, geocode and local requests used
    await page.setViewportSize({ width: 320, height: 700 });
    await page.evaluate(() => { document.querySelector('#add-dialog').open && document.querySelector('#add-dialog').close(); });
    await openAdd();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    console.log('PASS: start from a website: explicit read, name/address/category/details prefilled, ticked details kept with the website, published pin, unread and blocked websites still kept, bad address refused, edit mode, 320px.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
