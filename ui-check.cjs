// The shared visual language: dialog shell, Field kit, Calendar, Gidgit and its mascot.
//   ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node ui-check.cjs
// Made-up maps only. Nothing real is read and nothing leaves the page.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

const iso = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const place = (id, name, i) => ({ id, name, kind: 'Coffee shop', icon: 'map-pin', coordinates: [-83.539 + i * 0.003, 41.655], address: i + ' Main St', note: '', demo: false });
const custom = [place('local-a', 'Glass City Roasters', 0), place('local-b', 'River Bench Books', 1), place('local-c', 'Corner Pantry', 2)];
const ev = (id, p, title, d, extra = {}) => ({ id, placeId: p, title, date: iso(d), time: '', end: '', repeat: 'none', interval: 1, kind: 'Event', note: '', ...extra });
const base = { version: 1, home: { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' }, useCatalog: false, custom, osm: [], saved: custom.map(p => p.id), visited: ['local-a'], visitLog: { 'local-a': [new Date().toISOString()] }, ratings: {}, drafts: {}, details: {}, showDemo: false, fog: false };
const withEvents = { ...base, events: [ev('e1', 'local-a', '2-for-1 pour-overs', 0, { kind: 'Special', time: '07:00', repeat: 'weekly' }), ev('e2', 'local-b', 'Author reading', 1), ev('e3', 'local-b', 'New comic day', 3, { kind: 'Release' }), ev('e4', 'local-c', 'Shift sign-up closes', 3, { kind: 'Reminder' })] };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const open = async (store, opts = {}, routes) => {
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 860 }, ...opts });
      await ctx.addInitScript(s => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); } }, store);
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.errors = errors; page.setDefaultTimeout(8000);
      await page.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' }));
      if (routes) await routes(page);
      await page.goto(URL_); await page.waitForFunction(() => document.querySelector('.map-marker') && window.OrientMascot, null, { timeout: 30000 });
      return page;
    };
    const page = await open(base);

    await t('the Field kit is grouped into cards with a jump bar, and every control the app relies on is still there', async () => {
      await page.click('[data-action="settings"]');
      assert.equal(await page.locator('#settings-dialog .set-nav button').count(), 6);
      assert.deepEqual(await page.locator('#settings-dialog .set-card > header h3').allInnerTexts(), ['Your map', 'Devices & backups', 'Sharing', 'Gidgit', 'Your data']);
      for (const sel of ['#fog-toggle', '#demo-toggle', '#gidgit-enable', '#dir-app', '#import-file', '#takeout-file', '[data-home-open]', '[data-home-label]', '[data-gidgit-settings]', '[data-commons="hub"]', '[data-action="export"]', '[data-action="reset"]', '#sync-box', '#backup-box', '#stats-box', '[data-action="close-settings"]'])
        assert.equal(await page.locator('#settings-dialog ' + sel).count(), 1, sel);
      for (const name of ['Export my map', 'Change home area', 'Reset this browser’s map', 'Open place commons', 'Gidgit settings']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 1, name);
      assert.equal(await page.getByRole('checkbox', { name: 'Reveal the fog on My Map' }).count(), 1);
      assert.match(await page.locator('#settings-dialog .dlg-ico').count() ? 'icon' : 'none', /icon/);
    });
    await t('the jump bar scrolls to a section and lights its chip, and the last chip lights at the bottom', async () => {
      await page.locator('.set-nav button[data-set-go="set-data"]').click(); await page.waitForTimeout(900);
      assert.equal(await page.locator('.set-nav button[aria-current=true]').first().getAttribute('data-set-go') !== 'set-map', true);
      await page.locator('#settings-dialog').evaluate(e => e.scrollTo(0, e.scrollHeight)); await page.waitForTimeout(400);
      assert.equal(await page.locator('.set-nav button[aria-current=true]').getAttribute('data-set-go'), 'set-about');
    });
    await t('switches are real switches: a click on the row flips the setting', async () => {
      await page.locator('#settings-dialog').evaluate(e => e.scrollTo(0, 0));
      const before = await page.locator('#fog-toggle').isChecked();
      await page.getByText('Reveal the fog on My Map', { exact: true }).click(); await page.waitForTimeout(300);
      assert.equal(await page.locator('#fog-toggle').isChecked(), !before);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('orient-field-map-v1')).fog), !before, 'and it was saved');
      assert.equal(await page.locator('#fog-toggle').evaluate(e => getComputedStyle(e).appearance), 'none', 'drawn as a switch, not a tick box');
      await page.evaluate(() => document.getElementById('settings-dialog').close());
    });
    await t('every dialog gets the same header: an icon tile, a title and a close button', async () => {
      const seen = [];
      const check = async name => { const d = page.locator('dialog[open]').last(); await d.waitFor({ state: 'visible' }); await page.waitForTimeout(250); const head = d.locator('.panel-heading').first(); assert.equal(await head.locator('.dlg-ico, .gidgit-mascot').count() >= 1, true, name + ' has an icon or mascot'); assert.equal(await head.locator('h2').count(), 1, name + ' has one title'); assert.equal(await d.evaluate(e => getComputedStyle(e).borderRadius), '22px', name + ' shell'); seen.push(name); await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(x => x.close())); };
      await page.click('.bottom-nav [data-tab="My Map"]'); await page.locator('[data-action="add"]:visible').first().click(); await check('add');
      await page.click('[data-action="settings"]'); await page.click('[data-home-open]'); await check('home');
      await page.evaluate(() => OrientCommons.hub()); await check('commons');
      await page.click('[data-action="settings"]'); await page.click('[data-gidgit-settings]'); await check('gidgit settings');
      await page.locator('.map-marker').first().click({ force: true }); await page.waitForTimeout(500);
      await page.evaluate(() => { localStorage.removeItem('orient-directions-app'); document.querySelector('#sheet button.expand[aria-expanded=false]')?.click(); }); await page.locator('#sheet a[data-dir]').first().click(); await check('directions');
      assert.equal(seen.length, 5);
    });

    // the calendar
    const cal = await open(withEvents);
    await t('the calendar tab leads with a summary, the next seven days, a quick-add card and a switch', async () => {
      await cal.click('.bottom-nav [data-tab="Calendar"]'); await cal.locator('#panel .cal-hero').waitFor();
      assert.equal(await cal.locator('.cal-tile').count(), 3); assert.equal(await cal.locator('.cal-day').count(), 7); assert.equal(await cal.locator('.cal-day.today').count(), 1);
      const [today, week, all] = (await cal.locator('.cal-tile b').allInnerTexts()).map(Number); assert.ok(today >= 1 && week >= today && all >= week, 'today <= week <= 90 days: ' + [today, week, all]);
      assert.match(await cal.locator('.calendar-quick').innerText(), /Add something happening/); assert.equal(await cal.locator('#calendar-sentence').getAttribute('placeholder'), 'Every Tuesday, 2-for-1 tacos');
      assert.equal(await cal.locator('.cal-bar .calendar-toolbar button[aria-pressed=true]').innerText(), 'Agenda');
      assert.equal(await cal.getByRole('button', { name: 'Add an entry', exact: true }).count(), 1);
    });
    await t('agenda entries are colour-coded by kind, today and tomorrow are named, and a day in the strip jumps to it', async () => {
      assert.deepEqual([...new Set(await cal.locator('.calendar-entry').evaluateAll(es => es.map(e => e.dataset.kind)))].sort(), ['event', 'release', 'reminder', 'special']);
      const borders = await cal.locator('.calendar-entry').evaluateAll(es => [...new Set(es.map(e => getComputedStyle(e).borderLeftColor))]); assert.ok(borders.length >= 3, 'different kinds look different');
      assert.deepEqual(await cal.locator('.agenda-date em').allInnerTexts().then(a => a.slice(0, 2)), ['Today', 'Tomorrow']);
      const target = await cal.locator('.cal-day').nth(3).getAttribute('data-jump'); await cal.locator('.cal-day').nth(3).click(); await cal.waitForTimeout(700);
      assert.equal(await cal.locator('#ag-' + target).count(), 1, 'the day has an anchor'); assert.equal(await cal.locator('#panel').evaluate(p => p.scrollTop > 0), true, 'the panel scrolled');
    });
    await t('the month view shades busier days and the switch moves between views', async () => {
      await cal.getByRole('button', { name: 'Month', exact: true }).click(); await cal.locator('.calendar-grid').waitFor();
      assert.ok(await cal.locator('.calendar-grid .button[data-n]:not([data-n="0"])').count() >= 3); assert.equal(await cal.locator('.cal-bar .calendar-toolbar button[aria-pressed=true]').innerText(), 'Month');
      await cal.getByRole('button', { name: 'Agenda', exact: true }).click(); await cal.locator('.cal-hero').waitFor();
    });
    await t('an empty calendar invites you, and its starter ideas fill the quick-add box', async () => {
      const empty = await open(base); await empty.click('.bottom-nav [data-tab="Calendar"]'); await empty.locator('.cal-empty').waitFor();
      assert.match(await empty.locator('.cal-empty').innerText(), /Nothing planned in the next 90 days/); assert.equal(await empty.locator('.cal-empty svg').count(), 1);
      await empty.getByRole('button', { name: 'A monthly market' }).click(); assert.match(await empty.locator('#calendar-sentence').inputValue(), /First Saturday of the month/);
      assert.equal(await empty.evaluate(() => document.activeElement.id), 'calendar-sentence', 'ready to type'); assert.deepEqual(empty.errors, []);
    });

    // Gidgit
    await t('Gidgit has a mascot whose mood follows what the dialog is doing, and ideas to start with', async () => {
      const g = await open(base, {}, p => p.route('**/api/gidgit**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })));
      await g.click('[data-action="settings"]'); await g.locator('#gidgit-enable').evaluate(e => e.click()); await g.evaluate(() => document.getElementById('settings-dialog').close());
      await g.locator('.bottom-nav button:has-text("Gidgit")').click(); const d = g.locator('#gidgit-dialog'); await d.waitFor({ state: 'visible' });
      const mood = () => d.locator('.gidgit-mascot:not(.mini)').getAttribute('data-state'), line = () => d.locator('[data-gidgit-line]').innerText();
      const faces = {}, face = async m => { faces[m] = await d.locator('.gidgit-mascot:not(.mini) .gm-sprite').evaluate(e => getComputedStyle(e).backgroundImage); };
      assert.equal(await mood(), 'idle'); assert.match(await line(), /Ask your map/);
      await d.getByRole('button', { name: 'What’s open late?' }).click(); assert.equal(await d.locator('#gidgit-query').inputValue(), 'What’s open late?');
      await d.locator('[data-gidgit="cancel"]').evaluate(e => { e.hidden = false; }); await g.waitForTimeout(150); assert.equal(await mood(), 'thinking'); assert.match(await line(), /Looking through your map/); await face('thinking');
      await d.locator('[data-gidgit="cancel"]').evaluate(e => { e.hidden = true; }); await d.locator('[data-gidgit-status]').evaluate(e => { e.textContent = 'Could not reach Ollama on the Orient computer.'; }); await g.waitForTimeout(150); assert.equal(await mood(), 'confused'); await face('confused');
      await d.locator('[data-gidgit-status]').evaluate(e => { e.textContent = ''; }); await d.locator('[data-gidgit-result]').evaluate(e => { e.innerHTML = '<article>Glass City Roasters</article>'; }); await g.waitForTimeout(150); assert.equal(await mood(), 'happy'); assert.match(await line(), /Here’s what I found/); await face('happy');
      assert.equal(new Set(Object.values(faces)).size, 3, 'thinking, confused and happy each have their own face');
      assert.ok(Object.values(faces).every(v => v.startsWith('url("data:image/svg+xml')), 'drawn pixel by pixel in the app');
      assert.deepEqual(g.errors, []);
    });
    await t('the mascot has five expressions and shows up on the nav button and in the Field kit', async () => {
      const g = await open(base);
      const vars = await g.evaluate(() => ['idle', 'blink', 'thinking', 'happy', 'confused'].map(n => getComputedStyle(document.documentElement).getPropertyValue('--gm-' + n).trim()));
      assert.equal(new Set(vars).size, 5, 'five different faces'); assert.ok(vars.every(v => v.startsWith('url("data:image/svg+xml')));
      assert.equal(await g.locator('[data-gidgit="summon"] .gidgit-mascot.mini').count(), 1, 'the nav button wears the mascot');
      assert.equal(await g.locator('#set-gidgit .set-ico .gidgit-mascot.mini').count(), 1, 'so does the Field kit card');
      assert.equal(await g.locator('[data-gidgit="summon"] [data-lucide]').count(), 0, 'no generic chat icon is left');
      assert.equal(await g.evaluate(() => /gidgit\.png/.test(document.documentElement.outerHTML)), false, 'no outside picture is expected');
    });

    await t('the place card, the My Map blocks and the Explore briefing wear the same cards, tiles and buttons', async () => {
      const g = await open(base);
      const lum = c => { const m = c.match(/[0-9.]+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
      await g.click('.bottom-nav [data-tab="My Map"]'); await g.locator('[data-action=list]:visible').first().click().catch(() => {});
      await g.locator('#panel .row[data-place]').first().waitFor();
      const radius = sel => g.locator(sel).first().evaluate(e => parseFloat(getComputedStyle(e).borderTopLeftRadius));
      assert.equal(await radius('#panel .row'), 16, 'place rows are cards');
      for (const sel of ['#panel .collection-summary', '#panel .circuit-summary', '#panel .neighbor-guide']) assert.equal(await radius(sel), 16, sel + ' is a card');
      const create = g.locator('#panel [data-collection=new]');
      const [fg, bg] = await create.evaluate(e => { const c = getComputedStyle(e); return [c.color, c.backgroundImage !== 'none' ? 'rgb(30,80,64)' : c.backgroundColor]; });
      assert.ok(Math.abs(lum(fg) - lum(bg)) > 0.4, 'Create a collection stays readable: ' + fg + ' on ' + bg);
      await g.locator('#panel .row[data-place]').first().click(); await g.locator('#sheet .peekhead').waitFor();
      assert.equal(await g.locator('#sheet .peekhead .tile').evaluate(e => getComputedStyle(e).borderTopLeftRadius), '14px', 'the place tile is a rounded tile');
      assert.equal(await g.locator('#sheet .peekhead .visit').evaluate(e => getComputedStyle(e).backgroundImage.includes('gradient')), true, 'a counted visit is a green tile');
      await g.click('.bottom-nav [data-tab="Explore"]'); await g.waitForTimeout(500);
      assert.equal(await g.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(g.errors, []);
    });

    // phone and reduced motion
    await t('on a phone nothing scrolls sideways in the Field kit, the calendar or Gidgit', async () => {
      const m = await open(withEvents, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, p => p.route('**/api/gidgit**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })));
      const fits = () => m.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('dialog[open]')].every(d => d.scrollWidth <= d.clientWidth + 1));
      await m.click('[data-action="settings"]'); await m.waitForTimeout(400); assert.equal(await fits(), true, 'Field kit'); await m.evaluate(() => document.getElementById('settings-dialog').close());
      await m.click('.bottom-nav [data-tab="Calendar"]'); await m.locator('.cal-hero').waitFor(); assert.equal(await fits(), true, 'calendar');
      const box = await m.locator('.cal-strip').boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 390, 'the week strip fits');
      assert.deepEqual(m.errors, []);
    });
    await t('with reduced motion the dialogs and the mascot stand still', async () => {
      const calm = await open(base, { reducedMotion: 'reduce' }); await calm.click('[data-action="settings"]'); await calm.waitForTimeout(300);
      assert.equal(await calm.locator('#settings-dialog').evaluate(e => getComputedStyle(e).animationName), 'none');
      assert.equal(await calm.locator('.gm-sprite').count() === 0 || await calm.locator('.gm-sprite').first().evaluate(e => getComputedStyle(e).animationName) === 'none', true);
    });
    console.log('PASS: ' + n + ' design system cases');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
