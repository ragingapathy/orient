// Weather: the chip beside the title, the strip in Today, the report with history, the map's weather, and what is (not) sent.
//   ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node weather-check.cjs
// Every weather request is answered by a mock below, so nothing real is contacted and the results do not depend on the sky.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

const pad = v => String(v).padStart(2, '0');
// The mock lives in New York time, like the map's home, so "today" and "this hour" line up with the app.
const local = new Date(Date.now() - 4 * 3600e3);
const iso = (d, h = 0, m = 0) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(h) + ':' + pad(m);
const dayStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
const forecast = (code = 3, opts = {}) => {
  const times = [], temp = [], pop = [], codes = [], isDay = [];
  for (let i = 0; i < 7 * 24; i++) { const d = new Date(dayStart.getTime() + i * 3600e3); times.push(iso(d, d.getUTCHours())); temp.push(12 + (i % 24 > 6 && i % 24 < 18 ? 6 : 0)); pop.push(opts.rainAt !== undefined && i === local.getUTCHours() + opts.rainAt ? 80 : 5); codes.push(code); isDay.push(i % 24 > 6 && i % 24 < 19 ? 1 : 0); }
  const days = Array.from({ length: 7 }, (_, i) => new Date(dayStart.getTime() + i * 864e5));
  return {
    latitude: 41.7, longitude: -83.5, timezone: 'America/New_York',
    current: { time: iso(local, local.getUTCHours(), 0), temperature_2m: opts.temp ?? 12.8, apparent_temperature: 11, relative_humidity_2m: 66, weather_code: code, is_day: 1, precipitation: 0, cloud_cover: 100, wind_speed_10m: opts.wind ?? 14, wind_direction_10m: 270 },
    hourly: { time: times, temperature_2m: temp, precipitation_probability: pop, weather_code: codes, is_day: isDay },
    daily: { time: days.map(d => iso(d).slice(0, 10)), weather_code: days.map(() => code), temperature_2m_max: days.map((_, i) => 20 + i), temperature_2m_min: days.map((_, i) => 8 + i), precipitation_sum: days.map((_, i) => i === 2 ? 6 : 0), precipitation_probability_max: days.map((_, i) => i === 2 ? 70 : 10), sunrise: days.map(d => iso(d, 7, 31)), sunset: days.map(d => iso(d, 19, 3)), uv_index_max: days.map(() => 4.2), wind_speed_10m_max: days.map(() => 22) },
  };
};
const archive = url => {
  const q = new URL(url).searchParams, a = q.get('start_date'), b = q.get('end_date');
  if (a === b) { const y = +a.slice(0, 4); return { daily: { time: [a], weather_code: [y % 2 ? 61 : 3], temperature_2m_max: [10 + (y % 10)], temperature_2m_min: [2 + (y % 5)], precipitation_sum: [y % 2 ? 3 : 0], snowfall_sum: [0] } }; }
  const time = [], hi = [], lo = [], pr = []; for (let y = 1991; y <= 2020; y++) for (let d = new Date(Date.UTC(y, 0, 1)); d.getUTCFullYear() === y; d = new Date(d.getTime() + 864e5)) { time.push(iso(d).slice(0, 10)); hi.push(14 + (y % 7)); lo.push(5 + (y % 4)); pr.push(y === 2003 ? 30 : 1); }
  return { daily: { time, temperature_2m_max: hi, temperature_2m_min: lo, precipitation_sum: pr } };
};
const alert = { features: [{ properties: { event: 'Wind Advisory', severity: 'Moderate', headline: 'Wind Advisory until 8 PM EDT', description: 'Southwest winds 25 to 35 mph with gusts up to 50 mph.', instruction: 'Secure loose objects.', expires: new Date(Date.now() + 5 * 3600e3).toISOString(), areaDesc: 'Lucas, OH' } }] };

const place = (id, name, i) => ({ id, name, kind: 'Coffee shop', icon: 'map-pin', coordinates: [-83.539 + i * 0.003, 41.655], address: i + ' Main St', note: 'Private note about the secret garden', demo: false });
const custom = [place('local-a', 'Glass City Roasters', 0), place('local-b', 'River Bench Books', 1)];
const store = { version: 1, home: { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' }, useCatalog: false, custom, osm: [], saved: ['local-a', 'local-b'], visited: ['local-a'], neighbors: [{ id: 'neighbor-1', name: 'Secret Neighbor', note: 'Private' }] };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const open = async (opts = {}) => {
      const { code = 3, alerts = false, fail = false, prefs = null, viewport = { width: 1100, height: 860 }, extra = {}, reducedMotion = 'no-preference', keepStorage = null } = opts;
      const ctx = await browser.newContext({ viewport, reducedMotion, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
      await ctx.addInitScript(([s, p]) => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); if (p) localStorage.setItem('orient-weather-v1', JSON.stringify(p)); } }, [store, prefs]);
      const page = await ctx.newPage(); page.errors = []; page.log = []; page.on('pageerror', e => page.errors.push(e.message)); page.setDefaultTimeout(8000);
      await page.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' }));
      await page.route(/open-meteo\.com|api\.weather\.gov/, r => {
        const u = r.request().url(); page.log.push(u);
        if (fail) return r.abort();
        const json = body => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
        if (u.includes('archive-api')) return json(archive(u));
        if (u.includes('api.weather.gov')) return json(alerts ? alert : { features: [] });
        return json(forecast(code, extra));
      });
      await page.goto(URL_); await page.waitForFunction(() => document.querySelector('.map-marker') && window.OrientWeather, null, { timeout: 30000 });
      return page;
    };
    const chip = p => p.locator('.weather-chip');

    await t('the temperature and a weather icon sit beside the title and say what they are', async () => {
      const p = await open(); await chip(p).waitFor();
      assert.equal((await chip(p).locator('b').innerText()).trim(), '55°');
      assert.equal(await chip(p).locator('svg').count(), 1, 'an icon');
      assert.match(await chip(p).getAttribute('aria-label'), /Weather: 55°, overcast\. Open the weather report\./);
      const order = await p.evaluate(() => { const m = document.querySelector('.masthead'), c = [...m.children].map(e => e.className.split(' ')[0]); return c.indexOf('weather-chip') - c.indexOf('edition'); });
      assert.equal(order, 1, 'right after FIELD TEST');
      assert.deepEqual(p.errors, []);
    });
    await t('only the area, rounded to about 10 km, is sent, and only to the two weather services', async () => {
      const p = await open({ alerts: true }); await chip(p).waitFor(); await p.waitForTimeout(300);
      assert.ok(p.log.length >= 2, 'a forecast and an alert request');
      for (const u of p.log) {
        const x = new URL(u); assert.ok(['api.open-meteo.com', 'api.weather.gov'].includes(x.host), x.host);
        const lat = x.searchParams.get('latitude') || x.searchParams.get('point').split(',')[0], lng = x.searchParams.get('longitude') || x.searchParams.get('point').split(',')[1];
        if (x.host === 'api.open-meteo.com') { assert.equal(lat, '41.7'); assert.equal(lng, '-83.5'); } else { assert.equal(x.searchParams.get('point'), '41.70,-83.50'); }
        assert.equal(/Glass|Roasters|Bench|secret|Secret|Toledo|local-a/i.test(decodeURIComponent(u)), false, 'nothing from the map is in the request');
      }
    });
    await t('Today gets a weather line with the outlook, and it opens the report', async () => {
      const p = await open({ extra: { rainAt: 3 } }); await chip(p).waitFor();
      const strip = p.locator('.weather-strip'); await p.locator('.briefing-handle').click().catch(() => {}); await strip.waitFor();
      const text = await strip.innerText(); assert.match(text, /55° · Overcast/); assert.match(text, /High 68° · Low 46° · Rain likely around/);
      await strip.click(); await p.locator('#weather-dialog[open]').waitFor();
    });
    await t('the report shows now, 24 hours, the week, the facts and an alert', async () => {
      const p = await open({ alerts: true }); await chip(p).waitFor();
      assert.equal(await chip(p).getAttribute('data-alert'), '1'); assert.match(await chip(p).getAttribute('aria-label'), /Wind Advisory in effect/);
      await chip(p).click(); const d = p.locator('#weather-dialog'); await d.locator('.wx-hero').waitFor();
      assert.match(await d.locator('.wx-hero').innerText(), /55°[\s\S]*Overcast[\s\S]*Feels like 52° · High 68° · Low 46°/);
      assert.equal(await d.locator('.wx-hours li').count(), 12); assert.equal(await d.locator('.wx-week li').count(), 7);
      assert.match(await d.locator('.wx-week li').first().innerText(), /Today/); assert.match(await d.locator('.wx-week li').nth(1).innerText(), /Tomorrow/);
      assert.match(await d.locator('.wx-facts').first().innerText(), /Wind[\s\S]*9 mph from the west/);
      await d.locator('.wx-alert summary').click(); assert.match(await d.locator('.wx-alert').innerText(), /Southwest winds[\s\S]*Secure loose objects[\s\S]*National Weather Service/);
      assert.equal(await d.locator('#weather-title').innerText(), 'Toledo');
    });
    await t('this day in other years, and what is usual, are filled from the archive', async () => {
      const p = await open(); await chip(p).click(); const d = p.locator('#weather-dialog');
      await d.locator('.wx-years li').first().waitFor();
      assert.equal(await d.locator('.wx-years li').count(), 8);
      const rows = await d.locator('.wx-years li').allInnerTexts();
      assert.match(rows[0], /Last year/); assert.match(rows[3], /10 years ago/); assert.match(rows[7], /75 years ago/);
      assert.ok(rows.every(r => /(warmer|cooler) than today|about the same/.test(r)), 'each compares with today');
      await d.locator('.wx-usual').first().waitFor();
      assert.match(await d.locator('.wx-usual').first().innerText(), /highs are usually near [\d]+° and lows near [\d]+°/);
      assert.match(await d.locator('.wx-usual').nth(1).innerText(), /warmer than (nearly every high|\d+% of highs) around this date/);
      const mid = await p.evaluate(() => { const time = [], hi = [], lo = [], pr = []; for (let y = 2001; y <= 2010; y++) { time.push(y + '-10-10'); hi.push(10 + y - 2001); lo.push(1); pr.push(y === 2005 ? 9 : 0); } const s = OrientWeather.summarize({ time, temperature_2m_max: hi, temperature_2m_min: lo, precipitation_sum: pr }, 10, 10, 14.5); return { pct: s.pct, avgHi: s.avgHi, warm: s.warmest.year, wet: s.wettest.year, n: s.n }; });
      assert.deepEqual(mid, { pct: 50, avgHi: 14.5, warm: 2010, wet: 2005, n: 10 }, 'the usual-weather arithmetic');
      assert.equal(await d.locator('.wx-chart rect').count(), 30, 'one bar per year, 1991 to 2020');
      assert.match(await d.locator('.wx-chart').getAttribute('aria-label'), /1991 to 2020/);
      assert.match(await d.locator('[data-wx-climate] .wx-facts').innerText(), /Warmest[\s\S]*Coldest night[\s\S]*Wettest[\s\S]*2003/);
    });
    await t('units switch between °F and °C and are remembered', async () => {
      const p = await open(); await chip(p).click(); const d = p.locator('#weather-dialog'); await d.locator('.wx-hero').waitFor();
      await d.getByRole('button', { name: 'Show °C and km/h' }).click();
      assert.equal((await chip(p).locator('b').innerText()).trim(), '13°'); assert.match(await d.locator('.wx-facts').first().innerText(), /14 km\/h/);
      await p.reload(); await p.waitForFunction(() => window.OrientWeather); await chip(p).waitFor(); assert.equal((await chip(p).locator('b').innerText()).trim(), '13°');
    });
    await t('the map gets rain in rain, preview shows other weather, and closing the report puts it back', async () => {
      const p = await open({ code: 63 }); await chip(p).waitFor();
      const fx = p.locator('#weather-fx'); assert.equal(await fx.getAttribute('data-fx'), 'rain'); assert.equal(await fx.getAttribute('data-running'), 'true');
      await p.waitForTimeout(500);
      assert.ok(await fx.evaluate(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true; return false; }), 'something is drawn');
      assert.equal(await fx.evaluate(c => getComputedStyle(c).pointerEvents), 'none', 'it never takes a click');
      await chip(p).click(); await p.locator('summary', { hasText: 'Preview the map' }).click();
      for (const [kind, label] of [['snow', 'Snow'], ['storm', 'Thunderstorm'], ['fog', 'Fog'], ['clouds', 'Clouds']]) { await p.getByRole('button', { name: label, exact: true }).click(); assert.equal(await fx.getAttribute('data-fx'), kind); }
      await p.keyboard.press('Escape'); await p.waitForTimeout(200); assert.equal(await fx.getAttribute('data-fx'), 'rain', 'the real weather is back');
    });
    await t('clear skies draw nothing', async () => {
      const p = await open({ code: 0 }); await chip(p).waitFor(); assert.equal(await p.locator('#weather-fx').getAttribute('data-fx'), 'none'); assert.equal(await p.locator('#weather-fx').getAttribute('data-running'), 'false');
    });
    await t('under reduced motion the map weather stays still, but the chip and report still work', async () => {
      const p = await open({ code: 63, reducedMotion: 'reduce' }); await chip(p).waitFor();
      assert.equal(await p.locator('#weather-fx').getAttribute('data-running'), 'false');
      assert.equal((await chip(p).locator('b').innerText()).trim(), '55°'); await chip(p).click(); await p.locator('#weather-dialog .wx-hero').waitFor();
    });
    await t('the field kit can turn the map weather off, and then the weather off, with no more requests', async () => {
      const p = await open({ code: 63 }); await chip(p).waitFor(); await p.click('[data-action="settings"]');
      const fxBox = p.locator('#weather-fx-toggle'), box = p.locator('#weather-toggle');
      assert.equal(await box.isChecked(), true); assert.equal(await fxBox.isChecked(), true);
      await fxBox.uncheck(); assert.equal(await p.locator('#weather-fx').getAttribute('data-fx'), 'none'); assert.equal(await chip(p).count(), 1, 'the chip stays');
      await box.uncheck(); assert.equal(await chip(p).count(), 0); assert.equal(await fxBox.isDisabled(), true);
      const before = p.log.length; await p.evaluate(() => OrientWeather.refresh(true)); await p.waitForTimeout(300); assert.equal(p.log.length, before, 'switched off means no request');
      await p.reload(); await p.waitForFunction(() => window.OrientWeather); await p.waitForTimeout(500); assert.equal(await chip(p).count(), 0, 'remembered across reloads');
    });
    await t('a recent forecast is reused instead of asked for again', async () => {
      const p = await open(); await chip(p).waitFor(); const first = p.log.filter(u => u.includes('/v1/forecast')).length;
      await p.reload(); await p.waitForFunction(() => window.OrientWeather); await chip(p).waitFor(); assert.equal(p.log.filter(u => u.includes('/v1/forecast')).length, first, 'no second forecast request');
    });
    await t('when the weather cannot be reached the map carries on quietly', async () => {
      const p = await open({ fail: true }); await p.waitForTimeout(800);
      assert.equal(await chip(p).count(), 0); assert.equal(await p.locator('#weather-fx').getAttribute('data-fx').catch(() => 'none') === 'none', true);
      assert.ok(await p.locator('.map-marker').count() > 0, 'the map is fine'); assert.deepEqual(p.errors, []);
    });
    await t('on a phone the chip, the strip and the report fit the screen', async () => {
      const p = await open({ viewport: { width: 390, height: 844 }, alerts: true }); await chip(p).waitFor();
      const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('dialog[open]')].every(d => d.scrollWidth <= d.clientWidth + 1));
      const box = await chip(p).boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 390 && box.width >= 44, 'the chip is on screen and easy to tap');
      await chip(p).click(); await p.locator('#weather-dialog .wx-years li').first().waitFor(); await p.waitForTimeout(300); assert.equal(await fits(), true, 'the report fits');
      assert.deepEqual(p.errors, []);
    });
    if (process.env.WEATHER_SHOTS) { // WEATHER_SHOTS=<folder> saves pictures for a person to look at; it asserts nothing
      const dir = process.env.WEATHER_SHOTS;
      for (const [name, code] of [['rain', 63], ['snow', 73], ['storm', 95], ['fog', 45], ['clouds', 3]]) {
        const p = await open({ code, alerts: name === 'storm' }); await chip(p).waitFor(); await p.waitForTimeout(1800); await p.screenshot({ path: dir + '/map-' + name + '.png' });
      }
      const r = await open({ code: 63, alerts: true }); await chip(r).click(); await r.locator('.wx-years li').first().waitFor(); await r.locator('.wx-chart').waitFor(); await r.waitForTimeout(500);
      await r.locator('#weather-dialog').screenshot({ path: dir + '/report-top.png' });
      await r.locator('#weather-dialog').evaluate(d => { d.scrollTop = d.scrollHeight; }); await r.waitForTimeout(300); await r.locator('#weather-dialog').screenshot({ path: dir + '/report-bottom.png' });
      const m = await open({ code: 63, viewport: { width: 390, height: 844 } }); await chip(m).click(); await m.locator('.wx-years li').first().waitFor(); await m.waitForTimeout(400); await m.screenshot({ path: dir + '/phone-report.png' });
    }
    console.log('PASS: ' + n + ' weather cases');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
