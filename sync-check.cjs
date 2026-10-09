// Desktop and phone share one map. Starts its own server with a temporary data folder.
//   ORIENT_PLAYWRIGHT=<playwright folder> node sync-check.cjs
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const os = require('node:os'), fs = require('node:fs'), path = require('node:path');

const PORT = 4190 + Math.floor(Math.random() * 40);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-sync-'));
const DESK = `http://127.0.0.1:${PORT}`, PHONE = `http://orient.test:${PORT}`;
const KEY = 'orient-field-map-v1';
const pl = (id, name, lng, lat) => ({ id, name, kind: 'Coffee shop', icon: 'coffee', coordinates: [lng, lat], address: 'Toledo, OH', note: '', demo: false });
const seed = { version: 1, custom: [pl('local-roast', 'Glass City Roasters', -83.5395, 41.6535), pl('local-brew', '7 Brew', -83.55, 41.66)], osm: [], ratings: { 'local-roast': 4 }, saved: ['local-roast'], visited: [], drafts: {}, details: {}, events: [], showDemo: false, fog: false };

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'server.cjs')], { env: { ...process.env, PORT: String(PORT), ORIENT_DATA_DIR: dataDir }, stdio: 'ignore' });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--host-resolver-rules=MAP orient.test 127.0.0.1'] });
  try {
    for (let i = 0; i < 40; i++) { try { if ((await fetch(DESK + '/')).ok) break; } catch {} await new Promise(r => setTimeout(r, 150)); }
    const errors = [];
    const open = async (origin, init) => {
      const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
      if (init) await ctx.addInitScript(([k, s]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } }, [KEY, init]);
      const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(origin); await page.waitForFunction(() => window.OrientSync && window.OrientVisits, null, { timeout: 20000 });
      return page;
    };
    const stored = p => p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    const syncNow = async p => { await p.evaluate(() => OrientSync.now()); await p.waitForFunction(() => OrientSync.status().kind !== 'syncing', null, { timeout: 15000 }); };
    const serverState = async () => (await (await fetch(DESK + '/api/state')).json());

    // 1. the desktop is trusted and seeds the server
    const desk = await open(DESK, seed);
    await syncNow(desk);
    const s = await serverState();
    assert.equal(s.rev, 1); assert.deepEqual(s.state.saved, ['local-roast']); assert.equal(s.state.custom.length, 2);
    console.log('ok  desktop seeded the server');

    // 2. the phone address is not trusted: no pairing, no data, no key
    const phone = await open(PHONE);
    assert.equal(await phone.evaluate(() => fetch('/api/state').then(r => r.status)), 401);
    assert.equal(await phone.evaluate(() => fetch('/api/state/pair').then(r => r.status)), 403);
    assert.equal(await phone.evaluate(() => fetch('/api/state', { headers: { Authorization: 'Bearer ' + 'a'.repeat(48) } }).then(r => r.status)), 401);
    assert.equal(await phone.evaluate(() => OrientSync.status().kind), 'unpaired');
    assert.equal(await stored(phone), null, 'an unpaired phone must not receive the map');
    console.log('ok  unpaired phone gets nothing and cannot read the key');

    // 3. the desktop shows the key, the phone is paired by the link
    await desk.click('[data-action="settings"]'); await desk.click('[data-sync="show"]');
    const key = await desk.locator('#sync-key').inputValue(); assert.match(key, /^[a-f0-9]{48}$/);
    await desk.fill('#sync-address', PHONE);
    assert.equal(await desk.locator('#sync-link').inputValue(), `${PHONE}/#pair=${key}`);
    const paired = await open(`${PHONE}/#pair=${key}`);
    await syncNow(paired);
    const ps = await stored(paired);
    assert.deepEqual(ps.saved, ['local-roast']); assert.equal(ps.custom.length, 2); assert.equal(ps.ratings['local-roast'], 4);
    assert.equal(await paired.evaluate(() => location.hash), '', 'the key must not stay in the address bar');
    console.log('ok  paired phone received the map');

    // 4. a visit logged on the phone reaches the desktop
    await paired.evaluate(() => OrientVisits.add('local-brew'));
    await paired.waitForTimeout(2200); await syncNow(paired); await syncNow(desk);
    assert.equal((await stored(desk)).visitLog['local-brew'].length, 1);
    console.log('ok  a visit on the phone appeared on the desktop');

    // 5. both change things before either syncs: nothing is lost
    await paired.context().setOffline(true); await desk.context().setOffline(true);
    await paired.evaluate(() => { OrientVisits.add('local-roast'); });
    await desk.evaluate(() => { OrientVisits.addOn('local-brew', '2026-10-01'); });
    await paired.context().setOffline(false); await desk.context().setOffline(false);
    await syncNow(paired); await syncNow(desk); await syncNow(paired);
    const a = await stored(desk), b = await stored(paired);
    assert.equal(a.visitLog['local-roast'].length, 1); assert.equal(a.visitLog['local-brew'].length, 2);
    assert.deepEqual(a.visitLog, b.visitLog);
    console.log('ok  edits made at the same time on both devices were merged');

    // 6. a phone that cannot reach the computer keeps its changes and sends them later
    await paired.context().setOffline(true);
    await paired.evaluate(() => OrientVisits.addOn('local-brew', '2026-10-02'));
    await paired.evaluate(() => OrientSync.now()); await paired.waitForTimeout(800);
    assert.equal(await paired.evaluate(() => OrientSync.status().kind), 'offline');
    assert.equal((await stored(paired)).visitLog['local-brew'].length, 3, 'offline changes stay on the phone');
    await paired.context().setOffline(false); await syncNow(paired); await syncNow(desk);
    assert.equal((await stored(desk)).visitLog['local-brew'].length, 3);
    console.log('ok  offline phone kept its change and sent it when back');

    // 7. a new key cuts the old phone off
    await desk.evaluate(() => { window.confirm = () => true; }); await desk.click('[data-sync="renew"]');
    await desk.waitForFunction(k => document.getElementById('sync-key').value !== k, key);
    await syncNow(paired);
    assert.equal(await paired.evaluate(() => OrientSync.status().kind), 'unpaired');
    console.log('ok  a new key unpaired the old phone');

    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
    console.log('PASS: sync between a trusted desktop and a paired phone, merge, offline, unpairing');
  } finally { await browser.close(); server.kill(); try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {} }
})().catch(e => { console.error(e); process.exit(1); });
