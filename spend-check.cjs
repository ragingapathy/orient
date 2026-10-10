// Spending: what you write down at a place, the local-or-chain call, the totals on the place card, "Where your money goes" on
// My Map, the Add-spend shortcut after logging a visit, syncing between devices, and the exports.
//   ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node spend-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { merge } = require('./public/sync.js');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

const home = { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' };
const place = (id, name, dx) => ({ id, name, kind: 'Coffee shop', icon: 'coffee', coordinates: [-83.539 + dx, 41.655], address: '', note: '', demo: false });
const day = back => { const d = new Date(Date.now() - back * 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const base = () => ({ version: 1, home, useCatalog: false, custom: [place('local-a', 'Glass City Roasters', 0), place('local-b', 'Starbucks Reserve', 0.002), place('local-c', 'Corner Bakery Co-op', 0.004)], osm: [], saved: ['local-a', 'local-b', 'local-c'], visited: [], neighbors: [] });
const withSpend = () => ({
  ...base(),
  spend: {
    'local-a': [{ id: 'sp-a1', day: day(1), cents: 1850 }, { id: 'sp-a2', day: day(3), cents: 1250 }],
    'local-b': [{ id: 'sp-b1', day: day(2), cents: 900 }],
    'local-c': [{ id: 'sp-c1', day: day(40), cents: 2000 }],
  },
  ownership: { 'local-a': 'local', 'local-b': 'chain' },
});

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const open = async (store, opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 860 }, acceptDownloads: true, ...opts });
    await ctx.addInitScript(([s]) => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); localStorage.setItem('orient-weather-v1', JSON.stringify({ show: false })); localStorage.setItem('orient-roadwork-v1', JSON.stringify({ show: false })); localStorage.setItem('orient-civic-v1', JSON.stringify({ incidents: false })); } }, [store]);
    const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message)); p.setDefaultTimeout(10000);
    await p.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' })); await p.route('**/api/civic?*', r => r.fulfill({ status: 404, body: '{}' }));
    await p.goto(URL_); await p.waitForFunction(() => window.OrientSpend && document.querySelector('.bottom-nav'), null, { timeout: 20000 });
    return { ctx, p };
  };
  const myMap = async p => { await p.locator('.bottom-nav [data-tab="My Map"]').click(); await p.locator('[data-action=list]:visible').first().click().catch(() => {}); };
  const card = async (p, id) => { await myMap(p); await p.locator(`[data-place="${id}"]`).first().click(); for (let i = 0; i < 3 && !(await p.locator('.fold.spend-place summary').count()); i++) { await p.locator('[data-action=expand]:visible').first().click(); await p.waitForTimeout(450); } // a phone's drawer opens in two steps
    await p.locator('.fold.spend-place summary').waitFor(); if (!(await p.locator('.fold.spend-place').evaluate(d => d.open))) await p.locator('.fold.spend-place summary').click(); };
  const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('orient-field-map-v1')));
  try {
    await t('amounts are read like people write them, and bad ones are refused', async () => {
      const { ctx, p } = await open(base());
      const r = await p.evaluate(() => ({ a: OrientSpend.parseAmount('18.5'), b: OrientSpend.parseAmount('$1,250'), c: OrientSpend.parseAmount('0'), d: OrientSpend.parseAmount('-4'), e: OrientSpend.parseAmount('4.999'), f: OrientSpend.parseAmount('abc'), g: OrientSpend.parseAmount('99999999'), h: OrientSpend.fmt(1850), i: OrientSpend.fmt(8400), j: OrientSpend.fmt(123456) }));
      assert.deepEqual(r, { a: 1850, b: 125000, c: null, d: null, e: null, f: null, g: null, h: '$18.50', i: '$84', j: '$1,234.56' });
      await ctx.close();
    });
    await t('a saved map is cleaned: bad entries, unknown places and bad calls are dropped', async () => {
      const { ctx, p } = await open(base());
      const out = await p.evaluate(() => OrientSpend.clean({ spend: { 'local-a': [{ id: 'ok-1', day: '2026-10-01', cents: 500 }, { id: 'ok-1', day: '2026-10-01', cents: 600 }, { id: 'bad id!', day: '2026-10-01', cents: 5 }, { id: 'x2', day: '2026-02-31', cents: 5 }, { id: 'x3', day: '2026-10-01', cents: -5 }, { id: 'x4', day: '2026-10-01', cents: 2.5 }, 'junk'], nope: [{ id: 'z', day: '2026-10-01', cents: 5 }] }, ownership: { 'local-a': 'local', 'local-b': 'sketchy', nope: 'chain' }, spendRange: 7 }, new Set(['local-a', 'local-b'])));
      assert.deepEqual(out, { spend: { 'local-a': [{ id: 'ok-1', day: '2026-10-01', cents: 500 }] }, ownership: { 'local-a': 'local' }, spendRange: 0 });
      await ctx.close();
    });
    await t('well-known chains are only suggested; nothing is counted until you choose', async () => {
      const { ctx, p } = await open(base());
      const g = await p.evaluate(() => [OrientSpend.guess({ name: 'Starbucks' }), OrientSpend.guess({ name: 'Glass City Roasters' }), OrientSpend.guess({ name: 'Bob', brand: 'Walmart' }), OrientSpend.guess({ name: 'Subway Grille & Pizza' }), OrientSpend.guess({ name: 'Shellfish Shack' })]);
      assert.deepEqual(g, ['chain', '', 'chain', 'chain', '']);
      await card(p, 'local-b'); const note = await p.locator('.spend-owner-note').innerText(); assert.match(note, /Looks like a chain/);
      assert.equal(await p.locator('.spend-owner [aria-checked=true]').count(), 0, 'neither is chosen for you'); assert.deepEqual((await saved(p)).ownership || {}, {});
      await ctx.close();
    });
    await t('writing down a purchase gives the total, the average and the last day, and it stays after a reload', async () => {
      const { ctx, p } = await open(base()); await card(p, 'local-a');
      await p.fill('[name=spend-amount]', '18.50'); await p.click('.spend-add button[type=submit]');
      await p.locator('.fold.spend-place summary').waitFor(); assert.match(await p.locator('.fold.spend-place summary small').innerText(), /\$18\.50 total/);
      await p.fill('[name=spend-amount]', '$12.50'); await p.fill('[name=spend-day]', day(2)); await p.click('.spend-add button[type=submit]');
      const stats = await p.locator('.spend-stats').innerText(); assert.match(stats, /\$31[\s\S]*spent in all/); assert.match(stats, /\$15\.50[\s\S]*average · 2 times/); assert.match(stats, /Today/);
      assert.equal(await p.locator('.spend-list li').count(), 2);
      assert.equal(await p.evaluate(() => document.querySelector('.fold.spend-place').open), true, 'the section stays open while you add');
      const s = await saved(p); assert.deepEqual(s.spend['local-a'].map(e => e.cents).sort((a, b) => a - b), [1250, 1850]); assert.ok(s.spend['local-a'].every(e => /^sp-/.test(e.id) && /^\d{4}-\d{2}-\d{2}$/.test(e.day)));
      await p.reload(); await p.waitForFunction(() => window.OrientSpend); assert.equal((await saved(p)).spend['local-a'].length, 2);
      assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('a bad amount or a future day is explained, not saved', async () => {
      const { ctx, p } = await open(base()); await card(p, 'local-a');
      await p.fill('[name=spend-amount]', 'lots'); await p.click('.spend-add button[type=submit]'); assert.match(await p.locator('#spend-status').innerText(), /amount like 18\.50/);
      await p.fill('[name=spend-amount]', '5'); await p.evaluate(() => { const i = document.querySelector('[name=spend-day]'); i.removeAttribute('max'); i.value = '2999-01-01'; });
      await p.click('.spend-add button[type=submit]'); assert.match(await p.locator('#spend-status').innerText(), /not happened yet|Choose a date/);
      assert.equal((await saved(p)).spend?.['local-a'], undefined); await ctx.close();
    });
    await t('Local and Chain are your call; a second tap clears it, and a removed purchase is gone', async () => {
      const { ctx, p } = await open(withSpend()); await card(p, 'local-a');
      assert.equal(await p.locator('.spend-owner [data-spend-owner=local]').getAttribute('aria-checked'), 'true'); assert.match(await p.locator('.spend-owner-note').innerText(), /Counted as local/);
      await p.click('[data-spend-owner=chain]'); assert.equal((await saved(p)).ownership['local-a'], 'chain');
      assert.match(await p.locator('.spend-owner-note').innerText(), /chain or corporate/);
      await p.click('[data-spend-owner=chain]'); assert.equal((await saved(p)).ownership['local-a'], undefined, 'a second tap clears the call');
      await p.locator('.spend-list li').first().locator('[data-spend-remove]').click(); assert.equal((await saved(p)).spend['local-a'].length, 1);
      await p.locator('.spend-list li').first().locator('[data-spend-remove]').click(); assert.equal((await saved(p)).spend['local-a'], undefined, 'the last one removes the record');
      await ctx.close();
    });
    await t('the percentage is local ÷ (local + chain), and money you have not sorted is shown apart, not hidden', async () => {
      const { ctx, p } = await open(withSpend()); await myMap(p);
      const s = p.locator('.spend-summary'); await s.waitFor(); const text = await s.innerText();
      assert.match(text, /78%[\s\S]*of what you sorted stayed local/, '$31 local, $9 chain'); assert.match(text, /\$60 across 4 purchases at 3 places so far/); assert.match(text, /Not sorted yet[\s\S]*\$20/);
      assert.match(await s.locator('.spend-bar').getAttribute('aria-label'), /\$31 local, \$9 chain or corporate, \$20 not sorted yet/);
      const rows = await s.locator('.spend-row').allInnerTexts(); assert.match(rows[0], /Glass City Roasters[\s\S]*\$31 · 2 times · Local/); assert.match(rows[1], /Corner Bakery Co-op[\s\S]*Not sorted/); assert.match(rows[2], /Starbucks Reserve[\s\S]*Chain/);
      const widths = await s.locator('.spend-bar i').evaluateAll(l => l.map(i => i.getBoundingClientRect().width)); assert.equal(widths.length, 3); assert.ok(widths[0] > widths[1] && widths[0] > 0);
      await s.locator('[data-spend-range="30"]').click(); const t30 = await p.locator('.spend-summary').innerText(); assert.match(t30, /78%/); assert.match(t30, /\$40 across 3 purchases at 2 places in the last 30 days/); assert.doesNotMatch(t30, /Not sorted yet/);
      assert.equal((await saved(p)).spendRange, 30);
      await p.locator('.spend-summary [data-spend-range="0"]').click(); await s.locator('.spend-row').first().click(); await p.locator('.peekhead h2').waitFor(); assert.match(await p.locator('.peekhead h2').innerText(), /Glass City Roasters/);
      assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('with no spending the summary stays out of the way; with nothing sorted it says how to start', async () => {
      const a = await open(base()); await myMap(a.p); assert.equal(await a.p.locator('.spend-summary').count(), 0); await a.ctx.close();
      const store = { ...base(), spend: { 'local-a': [{ id: 'sp-1', day: day(0), cents: 700 }] } }; const b = await open(store); await myMap(b.p);
      const text = await b.p.locator('.spend-summary').innerText(); assert.match(text, /\$7[\s\S]*written down/); assert.match(text, /Mark places Local or Chain/); assert.doesNotMatch(text, /%/); await b.ctx.close();
    });
    await t('logging a visit offers Add spend, which opens the Spending section on that place', async () => {
      const { ctx, p } = await open({ ...base(), visited: ['local-b', 'local-c'] }); await myMap(p); await p.locator('[data-place="local-a"]').first().click(); // two others already visited, so no milestone toast covers this one
      await p.locator('[data-action=log-visit]').first().click(); await p.locator('#toast [data-action=spend-from-toast]').click();
      await p.locator('.fold.spend-place[open]').waitFor(); await p.waitForFunction(() => document.activeElement?.name === 'spend-amount', null, { timeout: 3000 }); // the amount box is ready to type in
      await p.keyboard.type('6.25'); await p.keyboard.press('Enter'); await p.waitForFunction(() => /\$6\.25 total/.test(document.querySelector('.fold.spend-place summary small')?.textContent || ''));
      assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('two devices that each wrote down a purchase keep both; a removed one stays removed', async () => {
      const b = withSpend(), phone = JSON.parse(JSON.stringify(b)), desk = JSON.parse(JSON.stringify(b));
      phone.spend['local-a'].push({ id: 'sp-phone', day: day(0), cents: 400 }); desk.spend['local-a'].push({ id: 'sp-desk', day: day(0), cents: 700 }); desk.spend['local-b'] = []; desk.ownership['local-c'] = 'local';
      const m = merge(b, phone, desk); assert.deepEqual(m.spend['local-a'].map(e => e.id).sort(), ['sp-a1', 'sp-a2', 'sp-desk', 'sp-phone']);
      assert.deepEqual(m.spend['local-b'], []); assert.equal(m.ownership['local-c'], 'local'); assert.equal(m.ownership['local-a'], 'local');
    });
    await t('removing a place takes its spending and its call with it', async () => {
      const { ctx, p } = await open(withSpend()); await card(p, 'local-a'); p.once('dialog', d => d.accept());
      await p.locator('[data-action=delete-place]').click(); await p.waitForFunction(() => !JSON.parse(localStorage.getItem('orient-field-map-v1')).custom.some(x => x.id === 'local-a'));
      const s = await saved(p); assert.equal(s.spend['local-a'], undefined); assert.equal(s.ownership['local-a'], undefined); assert.ok(s.spend['local-b']); await ctx.close();
    });
    await t('the CSV and GeoJSON exports carry the total and the call', async () => {
      const { ctx, p } = await open(withSpend()); await p.click('[data-action="settings"]');
      const grab = async fmt => { const [dl] = await Promise.all([p.waitForEvent('download'), p.click(`[data-open-export="${fmt}"]`)]); return fs.readFileSync(await dl.path(), 'utf8'); };
      const csv = (await grab('csv')).replace(/^﻿/, '').trim().split('\r\n'); const head = csv[0].split(','); assert.ok(head.includes('spent') && head.includes('ownership'));
      const row = csv.find(l => l.startsWith('Glass City Roasters')).split(','); assert.equal(row[head.indexOf('spent')], '31.00'); assert.equal(row[head.indexOf('ownership')], 'local');
      const gj = JSON.parse(await grab('geojson')); const a = gj.features.find(f => f.properties.name === 'Starbucks Reserve'); assert.equal(Number(a.properties.spent), 9); assert.equal(a.properties.ownership, 'chain');
      await ctx.close();
    });
    await t('spending is never part of what the commons or the insights read', async () => {
      for (const f of ['public/insights.js', 'public/commons.js', 'public/commons-data.js', 'public/social.js']) assert.doesNotMatch(fs.readFileSync(require('node:path').join(__dirname, f), 'utf8'), /spend|ownership/i, f);
    });
    await t('on a phone the section and the summary fit the screen', async () => {
      const { ctx, p } = await open(withSpend(), { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await myMap(p); await p.locator('.spend-summary').waitFor(); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const over = await p.locator('.spend-summary').evaluate(el => [...el.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > el.getBoundingClientRect().right + 1).length); assert.equal(over, 0, 'nothing pokes out of the card');
      await card(p, 'local-a');
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const form = await p.locator('.spend-add').evaluate(el => [...el.querySelectorAll('input,button')].every(e => e.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1)); assert.equal(form, true);
      await ctx.close();
    });
    await t('Same as last time writes the latest amount for today in one tap, and only shows once there is a last time', async () => {
      const a = await open(base()); await card(a.p, 'local-a'); assert.equal(await a.p.locator('[data-spend-repeat]').count(), 0); await a.ctx.close();
      const { ctx, p } = await open(withSpend()); await card(p, 'local-a');
      assert.match(await p.locator('[data-spend-repeat]').innerText(), /Same as last time · [$]18[.]50/, 'the most recent day, not the biggest');
      await p.click('[data-spend-repeat]');
      const e = (await saved(p)).spend['local-a']; assert.equal(e.length, 3); const fresh = e.find(x => x.day === day(0)); assert.ok(fresh && fresh.cents === 1850);
      assert.match(await p.locator('.spend-stats').innerText(), /[$]49[.]50/); assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('My Map shows six months side by side once two of them have spending, and not before', async () => {
      const one = { ...base(), spend: { 'local-a': [{ id: 'sp-1', day: day(0), cents: 700 }] }, ownership: { 'local-a': 'local' } }; const a = await open(one); await myMap(a.p);
      assert.equal(await a.p.locator('.spend-trend').count(), 0, 'one month is not a trend'); await a.ctx.close();
      const many = { ...base(), spend: { 'local-a': [{ id: 'sp-1', day: day(0), cents: 700 }, { id: 'sp-2', day: day(33), cents: 3000 }, { id: 'sp-3', day: day(66), cents: 1500 }], 'local-b': [{ id: 'sp-4', day: day(34), cents: 1000 }] }, ownership: { 'local-a': 'local', 'local-b': 'chain' } };
      const { ctx, p } = await open(many); await myMap(p); const tr = p.locator('.spend-trend'); await tr.waitFor();
      assert.equal(await tr.locator('.spend-month').count(), 6); const label = await tr.getAttribute('aria-label'); assert.match(label, /^Month by month: /); assert.match(label, /[$]7/);
      const months = await p.evaluate(() => OrientSpend.months().map(m => [m.local, m.chain, m.none, m.total])); assert.equal(months.length, 6); assert.equal(months.reduce((x, m) => x + m[3], 0), 6200, 'every purchase lands in a month');
      assert.deepEqual(months[5].slice(0, 3), [700, 0, 0], 'the current month holds the local purchase from today and nothing else');
      const heights = await tr.locator('.spend-col').evaluateAll(l => l.map(c => c.getBoundingClientRect().height)); assert.ok(Math.max(...heights) > 20 && heights.some(h => h === 0 || h < Math.max(...heights)), 'bars are scaled to the biggest month');
      assert.equal(await p.evaluate(() => document.querySelector('.spend-summary').scrollWidth <= document.querySelector('.spend-summary').clientWidth + 1), true); assert.deepEqual(p.errors, []); await ctx.close();
    });
    console.log('PASS: ' + n + ' spending cases');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
