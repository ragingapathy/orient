// Weather in the recommendations: "Get me out for a bit" and Today's "Still on your list" lean on the sky.
//   ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node weather-recs-check.cjs
// The weather is mocked (weather-mock.cjs); the places are made up.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const { forecast, archive, alertOf } = require('./weather-mock.cjs');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

const spot = (id, name, kind, i) => ({ id, name, kind, icon: 'map-pin', coordinates: [-83.539 + i * 0.002, 41.655], address: '', note: '', demo: false });
const custom = [spot('local-park', 'Walbridge Park', 'Public space', 0), spot('local-cafe', 'Glass City Roasters', 'Coffee shop', 1), spot('local-comics', 'River Bench Comics', 'Comic shop', 2)];
const store = { version: 1, home: { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' }, useCatalog: false, custom, osm: [], saved: custom.map(p => p.id), visited: [], neighbors: [] };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const open = async (o = {}) => {
      const { code = 0, extra = {}, severe = false, off = false, wait = true } = o;
      const ctx = await browser.newContext({ viewport: { width: 1100, height: 860 } });
      await ctx.addInitScript(([s, off]) => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); if (off) localStorage.setItem('orient-weather-v1', JSON.stringify({ show: false })); } }, [store, off]);
      const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(e.message)); page.setDefaultTimeout(8000);
      await page.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' }));
      await page.route(/open-meteo\.com|api\.weather\.gov/, r => {
        const u = r.request().url(), json = b => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
        if (u.includes('archive-api')) return json(archive(u)); if (u.includes('api.weather.gov')) return json(severe ? alertOf(true) : { features: [] });
        return json(forecast(code, extra));
      });
      await page.goto(URL_); await page.waitForFunction(() => window.OrientOutings && window.OrientWeather && document.querySelector('.map-marker'), null, { timeout: 30000 });
      if (wait && !off) await page.locator('.weather-chip').waitFor(); return page;
    };
    const ranked = (page, wx, options = {}) => page.evaluate(([wx, options]) => {
      const mk = (id, kind) => ({ id, name: id, kind, coordinates: [-83.539, 41.655] });
      const places = [mk('park', 'Public space'), mk('cafe', 'Coffee shop'), mk('comics', 'Comic shop')];
      const o = { minutes: '45', budget: '10', mode: 'walking', social: 'solo', ...options };
      return OrientOutings.suggest(places, { saved: [], visited: [], ratings: {} }, [-83.539, 41.655], o, [], 0, wx).map(c => ({ id: c.p.id, note: c.wx && c.wx.note }));
    }, [wx, options]);

    const p0 = await open({ code: 0 });
    await t('with no weather opinion the order is what it always was', async () => {
      const base = await ranked(p0, null); assert.deepEqual(base.map(c => c.id), ['comics', 'park'], 'no weather leaves the order alone');
      assert.deepEqual(await ranked(p0, { mood: 'fine', text: '' }), base.map(c => ({ ...c, note: null })));
    });
    await t('rough weather moves outdoor places down, brings indoor ones up and explains why', async () => {
      const r = await ranked(p0, { mood: 'rough', text: 'It’s raining: somewhere indoors keeps you dry.' });
      assert.deepEqual(r.map(c => c.id), ['comics', 'cafe'], 'both indoor places, the park drops out of the top two');
      assert.ok(r.every(c => /Indoors, and a good fit/.test(c.note)));
      const only = await ranked(p0, { mood: 'rough', text: 'It’s raining.' }, { budget: '0' }); assert.deepEqual(only.map(c => c.id), ['park'], 'a no-spend plan can only be a walk, so it stays, with a note');
      assert.equal(only[0].note, 'It’s raining.');
    });
    await t('iffy weather only nudges, lovely weather favours the park, a severe alert rules outdoors out', async () => {
      assert.deepEqual((await ranked(p0, { mood: 'iffy', text: 'Light rain.' })).map(c => c.id), ['comics', 'cafe']);
      const lovely = await ranked(p0, { mood: 'lovely', text: 'It’s 64° and clear: a nice time to be outside.' }); assert.equal(lovely[0].id, 'park'); assert.match(lovely[0].note, /nice time to be outside/); assert.equal(lovely[1].note, null);
      assert.deepEqual(await ranked(p0, { mood: 'rough', hard: true, text: 'Tornado Warning is in effect: best to stay inside.' }, { budget: '0' }), [], 'no outdoor walk at all');
      assert.equal((await ranked(p0, { mood: 'rough', hard: true, text: 'x' })).some(c => c.id === 'park'), false);
    });
    await t('the app reads the sky: rain, light rain, sun, a storm and a severe alert', async () => {
      const read = async o => { const p = await open(o); const j = await p.evaluate(() => OrientWeather.judge()); return j; };
      const rain = await read({ code: 63 }); assert.equal(rain.mood, 'rough'); assert.match(rain.text, /raining/);
      assert.equal((await read({ code: 61 })).mood, 'iffy');
      const sun = await read({ code: 0 }); assert.equal(sun.mood, 'lovely'); assert.match(sun.text, /It’s 55° and clear/);
      assert.equal((await read({ code: 95 })).mood, 'rough');
      const hot = await read({ code: 0, extra: { feels: 36 } }); assert.equal(hot.mood, 'rough'); assert.match(hot.text, /feels like 97°/);
      const cold = await read({ code: 3, extra: { feels: -12 } }); assert.equal(cold.mood, 'rough');
      const windy = await read({ code: 3, extra: { wind: 60, feels: 12 } }); assert.equal(windy.mood, 'rough');
      const severe = await read({ code: 0, severe: true }); assert.equal(severe.mood, 'rough'); assert.equal(severe.hard, true); assert.match(severe.text, /Tornado Warning/);
      assert.equal((await read({ code: 3 })).mood, 'fine', 'a plain grey day has no opinion');
      assert.equal(await (await open({ off: true })).evaluate(() => OrientWeather.judge()), null, 'with weather off, nothing is asked and nothing leans');
    });
    await t('Get me out for a bit shows the weather note on its cards', async () => {
      const p = await open({ code: 63 }); await p.locator('.briefing-handle').click(); await p.locator('[data-outing-open]').click();
      const d = p.locator('#outing-dialog'); await d.locator('.outing-choice').first().waitFor();
      assert.deepEqual(await d.locator('.outing-choice h3').allInnerTexts(), ['River Bench Comics', 'Glass City Roasters']);
      assert.ok((await d.locator('.outing-weather').allInnerTexts()).every(x => /Indoors, and a good fit/.test(x)));
      await p.keyboard.press('Escape');
      const q = await open({ code: 0 }); await q.locator('.briefing-handle').click(); await q.locator('[data-outing-open]').click();
      assert.match(await q.locator('#outing-dialog .outing-choice').first().innerText(), /Walbridge Park[\s\S]*nice time to be outside/);
    });
    await t('Today’s list leans the same way, and updates when the weather arrives', async () => {
      const rainy = await open({ code: 63 }); await rainy.locator('.briefing-handle').click(); const list = rainy.locator('[aria-label="Still on your list"]');
      await rainy.locator('[aria-label="Still on your list"] .today-reason').first().waitFor();
      const names = await list.locator('.today-place strong').allInnerTexts(); assert.equal(names.indexOf('Walbridge Park'), 2, 'the park is last when it is raining');
      assert.match(await rainy.locator('.weather-strip').innerText(), /Rain right now/, 'the Today line does not claim it is dry while it rains');
      assert.match(await list.innerText(), /Maybe on a drier day/); assert.match(await list.innerText(), /A good one for today’s weather/);
      const sunny = await open({ code: 0 }); await sunny.locator('.briefing-handle').click();
      await sunny.locator('[aria-label="Still on your list"] .today-reason').first().waitFor();
      assert.equal((await sunny.locator('[aria-label="Still on your list"] .today-place strong').first().innerText()), 'Walbridge Park');
      assert.match(await sunny.locator('[aria-label="Still on your list"]').innerText(), /A nice day for it/);
      const off = await open({ code: 63, off: true }); await off.locator('.briefing-handle').click();
      const plain = await off.locator('[aria-label="Still on your list"]').innerText(); assert.equal(/drier day|today’s weather|nice day/.test(plain), false); assert.match(plain, /Maybe today\?/);
    });
    console.log('PASS: ' + n + ' weather recommendation cases');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
