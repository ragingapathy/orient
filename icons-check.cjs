// Place icons: the star badge on saved pins (not a red alert dot), sensible default icons (a bakery is not a coffee cup), and the
// icon picker on the place card.   ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node icons-check.cjs
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

const home = { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' };
const place = (id, name, kind, dx, icon = 'coffee') => ({ id, name, kind, icon, coordinates: [-83.539 + dx, 41.655], address: '', note: '', demo: false });
const base = () => ({
  version: 1, home, useCatalog: false, osm: [], neighbors: [], visited: [], saved: ['local-a', 'local-b', 'local-c', 'local-d', 'local-e'],
  custom: [place('local-a', 'Sidon Lebanese Bakery', 'Food & drink', 0), place('local-b', 'Taco Bell', 'Food & drink', 0.003), place('local-c', 'Roma Pizza Palace', 'Food & drink', 0.006), place('local-d', '7 Brew', 'beverages', 0.009, 'map-pin'), place('local-e', "Dragon's Roost Coffee", 'Coffee shop', 0.012)],
});

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const open = async (store, opts = {}, count = 5) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 860 }, ...opts });
    await ctx.addInitScript(([s]) => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); localStorage.setItem('orient-weather-v1', JSON.stringify({ show: false })); localStorage.setItem('orient-roadwork-v1', JSON.stringify({ show: false })); localStorage.setItem('orient-civic-v1', JSON.stringify({ incidents: false })); } }, [store]);
    const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message)); p.setDefaultTimeout(10000);
    await p.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' })); await p.route('**/api/civic?*', r => r.fulfill({ status: 404, body: '{}' }));
    await p.goto(URL_); await p.waitForFunction(() => window.OrientIcons && document.querySelector('.bottom-nav'), null, { timeout: 20000 });
    await p.locator('.bottom-nav [data-tab="My Map"]').click(); await p.waitForFunction(c => document.querySelectorAll('.map-marker[data-place-id]').length >= c, count, { timeout: 20000 });
    return { ctx, p };
  };
  const pinIcon = (p, id) => p.evaluate(i => (document.querySelector(`.map-marker[data-place-id="${i}"] svg`)?.getAttribute('class') || '').replace(/^.*lucide-/, ''), id);
  const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('orient-field-map-v1')));
  const openCard = async (p, name) => { await p.locator('[data-action=list]:visible').first().click().catch(() => {}); await p.locator('.row[data-place]').filter({ hasText: name }).first().click(); await p.locator('.peekhead .tile-pick').waitFor(); };
  try {
    await t('a saved pin carries a small gold star, not a red alert dot; a visited pin has its check instead', async () => {
      const store = { ...base(), saved: ['local-a'], visited: ['local-b'] }; const { ctx, p } = await open(store, {}, 2);
      const badge = id => p.evaluate(i => { const pin = document.querySelector(`.map-marker[data-place-id="${i}"] .pin`), s = getComputedStyle(pin, '::after'); return { content: s.content, image: s.backgroundImage, w: s.width }; }, id);
      const a = await badge('local-a'); assert.notEqual(a.content, 'none'); assert.match(a.image, /^url\("data:image\/svg\+xml/); assert.match(decodeURIComponent(a.image), /<path d='M12 2\.5l2\.9/, 'a star shape'); assert.match(decodeURIComponent(a.image), /fill='#e0a643'/, 'gold, nothing like the accent red');
      assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.map-marker[data-place-id="local-a"] .pin'), '::after').backgroundColor !== 'rgb(202, 91, 48)'), true, 'not the accent colour');
      assert.equal((await badge('local-b')).content, 'none', 'visited shows its check instead');
      assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('generic food and drink places get a fitting icon from their name; real coffee shops keep the cup', async () => {
      const { ctx, p } = await open(base());
      assert.equal(await pinIcon(p, 'local-a'), 'croissant'); assert.equal(await pinIcon(p, 'local-b'), 'utensils'); assert.equal(await pinIcon(p, 'local-c'), 'pizza');
      assert.equal(await pinIcon(p, 'local-d'), 'cup-soda'); assert.equal(await pinIcon(p, 'local-e'), 'coffee');
      const h = await p.evaluate(() => [OrientIcons.hint({ kind: 'Food & drink', name: 'Mancy’s Steakhouse' }), OrientIcons.hint({ kind: 'Food & drink', name: 'Maumee Bay Brewing Company' }), OrientIcons.hint({ kind: 'Food & drink', name: 'Handel’s Ice Cream' }), OrientIcons.hint({ kind: 'Comic shop', name: 'Freedom Comics' }), OrientIcons.hint({ kind: 'Library', name: 'Toledo Public Library' })]);
      assert.deepEqual(h, ['utensils', 'beer', 'ice-cream-cone', '', '']); await ctx.close();
    });
    await t('tapping the icon on a place card opens the picker, with the current icon marked', async () => {
      const { ctx, p } = await open(base()); await openCard(p, 'Sidon');
      await p.locator('.peekhead .tile-pick').click(); const d = p.locator('#icon-dialog[open]'); await d.waitFor();
      assert.match(await d.locator('h2').innerText(), /Choose an icon for Sidon Lebanese Bakery/); assert.equal(await d.locator('[data-icon-choice=croissant]').getAttribute('aria-checked'), 'true');
      assert.equal(await d.locator('[aria-checked=true]').count(), 1); assert.ok((await d.locator('[data-icon-choice]').count()) > 60, 'a good choice of icons'); assert.equal(await d.locator('[data-icon-reset]').isDisabled(), true, 'nothing chosen yet, so nothing to undo');
      await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('#icon-dialog[open]')); assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('choosing an icon changes the pin and the card, is remembered for that place only, and survives a reload', async () => {
      const { ctx, p } = await open(base()); await openCard(p, 'Sidon'); await p.locator('.peekhead .tile-pick').click();
      await p.locator('#icon-dialog [data-icon-choice=cake]').click(); await p.waitForFunction(() => !document.querySelector('#icon-dialog[open]'));
      assert.equal(await pinIcon(p, 'local-a'), 'cake'); assert.equal(await pinIcon(p, 'local-b'), 'utensils', 'other places are untouched');
      assert.equal(await p.locator('.peekhead .tile-pick svg').first().getAttribute('class').then(c => c.replace(/^.*lucide-/, '')), 'cake');
      const s = await saved(p); assert.equal(s.details['local-a'].icon, 'cake'); assert.equal(s.details['local-b'], undefined);
      await p.reload(); await p.waitForFunction(() => document.querySelectorAll('.map-marker[data-place-id]').length >= 5); assert.equal(await pinIcon(p, 'local-a'), 'cake');
      assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('"Use the usual icon" goes back to the category and the name hint', async () => {
      const store = { ...base(), details: { 'local-a': { category: '', hours: '', people: '', note: '', icon: 'beer' } } }; const { ctx, p } = await open(store);
      assert.equal(await pinIcon(p, 'local-a'), 'beer'); await openCard(p, 'Sidon'); await p.locator('.peekhead .tile-pick').click();
      assert.equal(await p.locator('#icon-dialog [data-icon-choice=beer]').getAttribute('aria-checked'), 'true'); await p.locator('#icon-dialog [data-icon-reset]').click();
      await p.waitForFunction(() => !document.querySelector('#icon-dialog[open]')); assert.equal(await pinIcon(p, 'local-a'), 'croissant'); assert.equal((await saved(p)).details?.['local-a']?.icon, undefined); await ctx.close();
    });
    await t('a chosen icon wins over the category, even after the category changes; junk icon names are ignored', async () => {
      const store = { ...base(), details: { 'local-a': { category: 'Shops', hours: '', people: '', note: '', icon: 'gem' }, 'local-b': { category: '', hours: '', people: '', note: '', icon: '<img src=x onerror=alert(1)>' }, 'local-e': { category: '', hours: '', people: '', note: '', icon: 'not-an-icon' } } };
      const { ctx, p } = await open(store); assert.equal(await pinIcon(p, 'local-a'), 'gem'); assert.equal(await pinIcon(p, 'local-b'), 'utensils'); assert.equal(await pinIcon(p, 'local-e'), 'coffee');
      const s = await saved(p); await p.evaluate(() => OrientIcons.set('local-c', 'pizza')); const after = await saved(p);
      assert.equal(after.details['local-c'].icon, 'pizza'); assert.equal(after.details['local-b']?.icon, undefined, 'the junk name was not kept'); assert.equal(await p.evaluate(() => OrientIcons.valid('<img>')), false); assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('on a phone the picker fits the screen and every icon can be reached', async () => {
      const { ctx, p } = await open(base(), { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await p.locator('[data-action=list]:visible').first().click().catch(() => {});
      await p.locator('.row[data-place]').filter({ hasText: 'Roma' }).first().click(); await p.locator('.peekhead .tile-pick').click(); const d = p.locator('#icon-dialog[open]'); await d.waitFor();
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('#icon-dialog').scrollWidth <= document.querySelector('#icon-dialog').clientWidth + 1), true);
      const last = d.locator('[data-icon-choice]').last(); await last.scrollIntoViewIfNeeded(); const box = await last.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 390 && box.width >= 36, 'a thumb-sized target');
      await d.locator('[data-icon-choice=popcorn]').scrollIntoViewIfNeeded(); await d.locator('[data-icon-choice=popcorn]').click(); await p.waitForFunction(() => !document.querySelector('#icon-dialog[open]')); assert.equal((await saved(p)).details['local-c'].icon, 'popcorn'); await ctx.close();
    });
    console.log('PASS: ' + n + ' icon cases');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
