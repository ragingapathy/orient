// Times read as 5:00 pm (not 17:00) in the Calendar, Today and outing cards; and on a phone the app reaches the bottom edge of the screen.
//   ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node time-fit-check.cjs
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const D = require('./public/calendar-dates.js');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };
const d = k => { const x = new Date(Date.now() + k * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const store = { version: 1, home: { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' }, useCatalog: false, osm: [], neighbors: [], visited: [], saved: ['local-a'],
  custom: [{ id: 'local-a', name: 'Test Cafe', kind: 'Coffee shop', icon: 'coffee', coordinates: [-83.539, 41.655], address: '', note: '', demo: false }],
  events: [{ id: 'e1', placeId: 'local-a', title: 'Trivia night', kind: 'Event', date: d(0), time: '19:00', end: '21:30', repeat: 'none', days: [], skip: [] }, { id: 'e2', placeId: 'local-a', title: 'Happy hour', kind: 'Special', date: d(0), time: '16:00', end: '18:00', repeat: 'none', days: [], skip: [] }, { id: 'e3', placeId: 'local-a', title: 'Open mic', kind: 'Event', date: d(1), time: '10:30', end: '', repeat: 'none', days: [], skip: [] }] };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const open = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' });
    await ctx.addInitScript(([s]) => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); localStorage.setItem('orient-weather-v1', JSON.stringify({ show: false })); localStorage.setItem('orient-roadwork-v1', JSON.stringify({ show: false })); localStorage.setItem('orient-civic-v1', JSON.stringify({ incidents: false })); } }, [store]);
    const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message)); await p.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' })); await p.route('**/api/civic?*', r => r.fulfill({ status: 404, body: '{}' }));
    await p.goto(URL_); await p.waitForFunction(() => window.OrientCalendar && document.querySelector('.bottom-nav'), null, { timeout: 20000 }); return { ctx, p };
  };
  try {
    await t('a time is spoken the way people say it, and a range shares its am/pm', async () => {
      assert.equal(D.clock('17:00'), '5:00 pm'); assert.equal(D.clock('09:05'), '9:05 am'); assert.equal(D.clock('00:30'), '12:30 am'); assert.equal(D.clock('12:00'), '12:00 pm'); assert.equal(D.clock('nonsense'), 'nonsense'); assert.equal(D.clock(''), '');
      assert.equal(D.clockSpan('17:00', '19:00'), '5:00–7:00 pm'); assert.equal(D.clockSpan('10:00', '13:30'), '10:00 am–1:30 pm'); assert.equal(D.clockSpan('11:00', ''), '11:00 am');
    });
    await t('the Calendar, Today and the outing card show 12-hour times', async () => {
      const { ctx, p } = await open();
      await p.locator('.bottom-nav [data-tab="Calendar"]').click(); await p.locator('.calendar-entry').first().waitFor();
      const cal = await p.locator('#panel').innerText(); assert.match(cal, /7:00–9:30 pm/); assert.match(cal, /4:00–6:00 pm/); assert.match(cal, /10:30 am · End time unknown/); assert.doesNotMatch(cal, /\b(1[3-9]|2[0-3]):[0-5][0-9]\b/, 'no 24-hour time is left');
      await p.locator('.bottom-nav [data-tab="Explore"]').click(); await p.evaluate(() => document.querySelector('.briefing-handle')?.click()); await p.waitForTimeout(500);
      const today = await p.locator('#panel').innerText(); assert.doesNotMatch(today, /\b(1[3-9]|2[0-3]):[0-5][0-9]\b/); assert.match(today, /[0-9]:[0-5][0-9][^\n]*(am|pm)/);
      assert.deepEqual(p.errors, []); await ctx.close();
    });
    await t('on a phone the app is pinned to the whole screen, with no strip of the page showing below it', async () => {
      const { ctx, p } = await open();
      const m = await p.evaluate(() => { const app = document.querySelector('#app'), r = app.getBoundingClientRect(); return { pos: getComputedStyle(app).position, top: r.top, bottom: r.bottom, h: innerHeight, nav: document.querySelector('.bottom-nav').getBoundingClientRect().bottom, surface: getComputedStyle(app).backgroundColor, html: getComputedStyle(document.documentElement).backgroundColor, body: getComputedStyle(document.body).backgroundColor }; });
      assert.equal(m.pos, 'fixed'); assert.equal(m.top, 0); assert.equal(m.bottom, m.h); assert.equal(m.nav, m.h, 'the tab bar sits on the bottom edge');
      assert.equal(m.html, m.surface, 'and anything behind the app is the app colour, not sage'); assert.equal(m.body, m.surface);
      await ctx.close();
    });
    console.log('PASS: ' + n + ' time and fit cases');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
