// Pin clustering: pins that would overlap are drawn as one round "N places" button; tapping it zooms in, or lists places that share a spot.
//   ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node clusters-check.cjs
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

const home = { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' };
const place = (id, name, lng, lat, kind = 'Coffee shop') => ({ id, name, kind, icon: 'coffee', coordinates: [lng, lat], address: '', note: '', demo: false });
// five shops a few steps apart downtown, two businesses at exactly the same spot, and one on its own
const A = [0, 1, 2, 3, 4].map(i => place('local-a' + i, 'Downtown shop ' + (i + 1), -83.539 + i * 0.0003, 41.655));
const B = [place('local-b1', 'Same spot café', -83.50, 41.68), place('local-b2', 'Same spot bakery', -83.50, 41.68, 'Bakery')];
const lone = place('local-lone', 'Lone library', -83.58, 41.62, 'Library');
const store = { version: 1, home, useCatalog: false, osm: [], neighbors: [], visited: [], custom: [...A, ...B, lone], saved: [...A, ...B, lone].map(p => p.id) };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const open = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 860 }, ...opts });
    await ctx.addInitScript(([s]) => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); localStorage.setItem('orient-weather-v1', JSON.stringify({ show: false })); localStorage.setItem('orient-roadwork-v1', JSON.stringify({ show: false })); localStorage.setItem('orient-civic-v1', JSON.stringify({ incidents: false })); } }, [store]);
    const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message)); p.setDefaultTimeout(10000);
    await p.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' })); await p.route('**/api/civic?*', r => r.fulfill({ status: 404, body: '{}' }));
    await p.goto(URL_); await p.waitForFunction(() => window.OrientClusters && window.OrientBoard && document.querySelector('.bottom-nav'), null, { timeout: 20000 });
    await p.locator('.bottom-nav [data-tab="My Map"]').click(); await p.waitForFunction(() => document.querySelectorAll('.map-marker').length >= 8, null, { timeout: 20000 });
    return { ctx, p };
  };
  const fly = async (p, lng, lat, z) => { await p.evaluate(a => OrientBoard.flyTo(...a), [lng, lat, z]); await p.waitForFunction(() => { const v = OrientRoadwork.view(); return !!v; }); await p.waitForTimeout(1600); };
  const zoomOf = p => p.evaluate(() => OrientRoadwork.view().zoom);
  const visiblePins = p => p.evaluate(() => [...document.querySelectorAll('.map-marker')].filter(m => !m.classList.contains('clustered')).map(m => m.dataset.placeId));
  const clusterLabels = p => p.evaluate(() => [...document.querySelectorAll('.map-cluster')].map(c => c.getAttribute('aria-label')));
  try {
    await t('zoomed out, shops that overlap become one "5 places" button; the lone place keeps its pin', async () => {
      const { ctx, p } = await open(); await fly(p, -83.5392, 41.655, 12.5);
      const labels = await clusterLabels(p); assert.ok(labels.some(l => /^5 places here\. Zoom in to see them\.$/.test(l)), JSON.stringify(labels));
      const pins = await visiblePins(p); assert.ok(pins.includes('local-lone'), 'the lone place is still a pin'); assert.equal(pins.filter(i => i.startsWith('local-a')).length, 0, 'the five shops are folded away');
      assert.equal((await p.locator('.map-cluster[aria-label^="5 places"]').innerText()).trim(), '5', 'the button shows the count');
      assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('tapping the button zooms in, and zoomed in far enough the places are separate pins again', async () => {
      const { ctx, p } = await open(); await fly(p, -83.5392, 41.655, 12.5); const before = await zoomOf(p);
      await p.locator('.map-cluster[aria-label^="5 places"]').click(); await p.waitForTimeout(1500);
      assert.ok((await zoomOf(p)) > before + 2, 'it zoomed in on the group');
      const pins = await visiblePins(p); assert.equal(pins.filter(i => i.startsWith('local-a')).length, 5, 'all five show as pins'); assert.equal(await p.locator('.map-cluster[aria-label^="5 places"]').count(), 0);
      assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('places at exactly the same spot keep one button at any zoom; tapping it lists them, and picking one opens it', async () => {
      const { ctx, p } = await open(); await fly(p, -83.50, 41.68, 17);
      const label = await p.locator('.map-cluster[aria-label$="Open the list."]').getAttribute('aria-label'); assert.match(label, /Open the list\./);
      await p.locator('.map-cluster[aria-label$="Open the list."]').click(); const list = p.locator('.cluster-list'); await list.waitFor();
      assert.match(await list.innerText(), /2 places here[\s\S]*Same spot (café|bakery)/); assert.equal(await list.locator('[data-cluster-pick]').count(), 2);
      await list.locator('[data-cluster-pick="local-b2"]').click(); await p.locator('.peekhead h2').waitFor(); assert.match(await p.locator('.peekhead h2').innerText(), /Same spot bakery/);
      await p.waitForFunction(() => !document.querySelector('.cluster-list') && !document.querySelector('.map-cluster'), null, { timeout: 4000 });
      const pins = await visiblePins(p); assert.ok(pins.includes('local-b1') && pins.includes('local-b2'), 'with the other one open, neither is hidden');
      assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('the place you have open is never folded into a group', async () => {
      const { ctx, p } = await open(); await fly(p, -83.5392, 41.655, 12.5);
      await p.locator('[data-action=list]:visible').first().click().catch(() => {}); await p.locator('#panel [data-place="local-a2"]').first().click(); await p.locator('.peekhead h2').waitFor();
      await p.waitForFunction(() => !document.querySelector('.map-marker[data-place-id="local-a2"]').classList.contains('clustered'), null, { timeout: 4000 });
      assert.ok((await clusterLabels(p)).some(l => /^4 places here/.test(l)), 'the other four stay together: ' + JSON.stringify(await clusterLabels(p)));
      assert.ok((await visiblePins(p)).includes('local-a2')); assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('the button works from the keyboard, and Escape closes the list and gives focus back', async () => {
      const { ctx, p } = await open(); await fly(p, -83.50, 41.68, 14);
      const btn = p.locator('.map-cluster[aria-label$="Open the list."]'); await btn.focus(); await p.keyboard.press('Enter'); await p.locator('.cluster-list').waitFor();
      assert.equal(await p.evaluate(() => document.activeElement.hasAttribute('data-cluster-pick')), true, 'focus moves into the list');
      await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('.cluster-list')); assert.equal(await p.evaluate(() => document.activeElement.classList.contains('map-cluster')), true, 'focus returns to the button');
      await ctx.close();
    });
    await t('folded pins give up their names, so no label floats over a button', async () => {
      const { ctx, p } = await open(); await fly(p, -83.5392, 41.655, 14);
      const shown = await p.evaluate(() => [...document.querySelectorAll('.map-marker')].filter(m => m.querySelector('.pin-label.on')).map(m => m.dataset.placeId));
      assert.equal(shown.filter(i => i.startsWith('local-a')).length, 0, 'a folded pin shows no name: ' + shown.join()); await ctx.close();
    });
    await t('on a phone the buttons and the list fit the screen', async () => {
      const { ctx, p } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await fly(p, -83.50, 41.68, 15);
      await p.locator('.map-cluster[aria-label$="Open the list."]').tap(); const list = p.locator('.cluster-list'); await list.waitFor(); const box = await list.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, JSON.stringify(box)); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('the field kit switch turns grouping off and on, and it is remembered', async () => {
      const { ctx, p } = await open(); await fly(p, -83.5392, 41.655, 12.5);
      assert.ok((await p.locator('.map-cluster').count()) > 0); await p.click('[data-action="settings"]'); const box = p.locator('#clusters-toggle'); assert.equal(await box.isChecked(), true, 'on by default');
      await box.uncheck(); await p.waitForFunction(() => !document.querySelector('.map-cluster') && !document.querySelector('.map-marker.clustered'), null, { timeout: 4000 });
      assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('orient-clusters-v1')).on), false);
      await p.reload(); await p.waitForFunction(() => document.querySelectorAll('.map-marker').length >= 8); await p.locator('.bottom-nav [data-tab="My Map"]').click(); await p.waitForTimeout(500);
      assert.equal(await p.locator('.map-cluster').count(), 0, 'still off after a reload'); await p.click('[data-action="settings"]'); assert.equal(await p.locator('#clusters-toggle').isChecked(), false);
      await p.locator('#clusters-toggle').check(); await p.waitForFunction(() => document.querySelector('.map-cluster') || document.querySelector('.map-marker.clustered') || true); assert.deepEqual(p.errors, []); await ctx.close();
    });
    console.log('PASS: ' + n + ' clustering cases');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
