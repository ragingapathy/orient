// Backups of the synced map: rotation, verification, the shrink guard, restore, the endpoint and the panel.
//   ORIENT_PLAYWRIGHT=<folder> node backup-check.cjs
// Fictional maps in temporary folders. Nothing real is read.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const cp = require('node:child_process');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

const tmp = p => fs.mkdtempSync(path.join(os.tmpdir(), p));
const map = (places, visits = 0) => ({ version: 1, custom: Array.from({ length: places }, (_, i) => ({ id: 'local-' + i, name: 'Place ' + i, coordinates: [-83.5, 41.6] })), saved: [], visited: [], visitLog: visits ? { 'local-0': Array.from({ length: visits }, (_, i) => '2026-09-' + String(1 + (i % 28)).padStart(2, '0')) } : {} });
const envelope = (rev, state) => ({ rev, updatedAt: new Date(Date.UTC(2026, 9, 10, 12, rev)).toISOString(), state });
const withDir = (dir, fn) => { process.env.ORIENT_DATA_DIR = dir; return fn(); };
const B = require('./backup.cjs');
const live = dir => path.join(dir, 'orient-state.json');
const put = (dir, env) => fs.writeFileSync(live(dir), JSON.stringify(env));
const names = dir => fs.existsSync(path.join(dir, 'backups')) ? fs.readdirSync(path.join(dir, 'backups')).sort() : [];

(async () => {
  await t('a backup is a verified copy of the live map, refreshed through the day and never made from nothing', () => {
    const dir = tmp('bk-a-'); withDir(dir, () => {
      assert.match(B.take(new Date('2026-10-10T08:00:00Z')).skipped, /no map/);
      put(dir, { rev: 0, updatedAt: null, state: null }); assert.match(B.take().skipped, /empty or unreadable/);
      put(dir, envelope(1, map(12)));
      const r = B.take(new Date('2026-10-10T08:00:00Z')); assert.equal(r.ok, true); assert.equal(r.name, 'orient-state-2026-10-10.json');
      assert.equal(fs.readFileSync(path.join(dir, 'backups', r.name), 'utf8'), fs.readFileSync(live(dir), 'utf8'));
      put(dir, envelope(2, map(13))); B.take(new Date('2026-10-10T18:00:00Z'));
      assert.deepEqual(names(dir), ['orient-state-2026-10-10.json'], 'the same day keeps one file');
      assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'backups', 'orient-state-2026-10-10.json'), 'utf8')).rev, 2, 'refreshed with the newer map');
      assert.equal(names(dir).some(f => f.endsWith('.tmp')), false);
    });
  });
  await t('a damaged live map never replaces a good backup', () => {
    const dir = tmp('bk-b-'); withDir(dir, () => {
      put(dir, envelope(1, map(12))); B.take(new Date('2026-10-10T08:00:00Z'));
      const good = fs.readFileSync(path.join(dir, 'backups', 'orient-state-2026-10-10.json'), 'utf8');
      for (const bad of ['{ "rev": 2, "state": { "version": ', JSON.stringify({ rev: 2, state: { version: 2 } }), JSON.stringify({ rev: 2, state: [] }), '']) {
        fs.writeFileSync(live(dir), bad); assert.ok(B.take(new Date('2026-10-10T20:00:00Z')).skipped, 'refused: ' + bad.slice(0, 20));
      }
      assert.equal(fs.readFileSync(path.join(dir, 'backups', 'orient-state-2026-10-10.json'), 'utf8'), good);
    });
  });
  await t('rotation keeps two weeks of days, then only Sundays, for eight weeks', () => {
    const dir = tmp('bk-c-'); withDir(dir, () => {
      put(dir, envelope(1, map(12)));
      const start = Date.UTC(2026, 7, 12); // 60 days ending 2026-10-10
      for (let i = 0; i < 60; i++) B.take(new Date(start + i * 864e5));
      const days = names(dir).map(f => f.slice(13, 23)).sort().reverse();
      assert.deepEqual(days.slice(0, 14), Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 9, 10) - i * 864e5).toISOString().slice(0, 10)), 'the newest 14 days are all there');
      const older = days.slice(14); assert.ok(older.length > 0 && older.length <= 8);
      for (const d of older) assert.equal(new Date(d + 'T00:00:00Z').getUTCDay(), 0, d + ' is a Sunday');
      const wantSundays = Array.from({ length: 60 - 14 }, (_, i) => new Date(Date.UTC(2026, 9, 10) - (14 + i) * 864e5)).filter(d => d.getUTCDay() === 0).length;
      assert.equal(older.length, Math.min(8, wantSundays));
    });
  });
  await t('a write that shrinks the map sharply saves the map as it was first, once an hour, and ignores ordinary changes', () => {
    const dir = tmp('bk-d-'); withDir(dir, () => {
      const before = envelope(5, map(30, 40)), t0 = new Date('2026-10-10T10:00:00Z');
      assert.equal(B.beforeWrite(before, map(25, 40), t0), null, 'a small shrink is just editing');
      assert.equal(B.beforeWrite(envelope(1, map(4)), map(0), t0), null, 'a tiny map is not worth guarding');
      const name = B.beforeWrite(before, map(2), t0); assert.match(name, /^orient-state-before-change-2026-10-10T10-00-00Z\.json$/);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'backups', name), 'utf8')), before, 'the map as it was');
      assert.equal(B.beforeWrite(before, map(1), new Date(t0.getTime() + 20 * 60e3)), null, 'one safety copy an hour');
      assert.ok(B.beforeWrite(before, map(1), new Date(t0.getTime() + 61 * 60e3)));
      assert.equal(B.beforeWrite(null, map(1)), null); assert.equal(B.beforeWrite({ rev: 0, state: null }, map(1)), null);
      for (let i = 2; i < 9; i++) B.beforeWrite(before, map(1), new Date(t0.getTime() + i * 2 * 3600e3));
      assert.equal(names(dir).filter(f => /before-change/.test(f)).length, B.EXTRA, 'only the newest few safety copies are kept');
    });
  });
  await t('the list marks unreadable copies and finds the newest good one', () => {
    const dir = tmp('bk-e-'); withDir(dir, () => {
      put(dir, envelope(1, map(12))); B.take(new Date('2026-10-08T08:00:00Z')); B.take(new Date('2026-10-09T08:00:00Z')); B.take(new Date('2026-10-10T08:00:00Z'));
      fs.writeFileSync(path.join(dir, 'backups', 'orient-state-2026-10-10.json'), '{ broken');
      const l = B.list(); assert.equal(l.backups.length, 3); assert.equal(l.backups[0].ok, false);
      assert.equal(l.lastGood.name, 'orient-state-2026-10-09.json'); assert.equal(l.counts.daily, 3);
      assert.equal(l.lastGood.items, 12);
    });
  });

  // ---- restore, end to end ----
  const restore = (dir, ...a) => cp.spawnSync(process.execPath, [path.join(__dirname, 'restore-backup.cjs'), ...a], { encoding: 'utf8', env: { ...process.env, ORIENT_DATA_DIR: dir } });
  await t('restore saves what is there now, checks the copy, bumps the revision, and refuses anything unreadable or unknown', () => {
    const dir = tmp('bk-f-'); withDir(dir, () => {
      put(dir, envelope(3, map(12, 5))); B.take(new Date('2026-10-09T08:00:00Z'));
      put(dir, envelope(9, map(20, 9))); B.take(new Date('2026-10-10T08:00:00Z'));
      put(dir, envelope(10, map(21, 9)));
      const listing = restore(dir); assert.equal(listing.status, 0); assert.match(listing.stdout, /2026-10-09/); assert.match(listing.stdout, /2026-10-10/);
      assert.equal(restore(dir, '2026-01-01').status, 1);
      const r = restore(dir, '2026-10-09'); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /docker compose restart/);
      const now = JSON.parse(fs.readFileSync(live(dir), 'utf8'));
      assert.equal(now.rev, 11, 'newer than anything the devices have seen'); assert.equal(now.state.custom.length, 12); assert.equal(B.check(JSON.stringify(now)) !== null, true);
      const safety = names(dir).find(f => /before-restore/.test(f)); assert.ok(safety, 'the map as it was is kept');
      assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'backups', safety), 'utf8')).state.custom.length, 21);
      fs.writeFileSync(path.join(dir, 'backups', 'orient-state-2026-10-10.json'), 'nope');
      const bad = restore(dir, '2026-10-10'); assert.equal(bad.status, 1); assert.match(bad.stderr, /cannot be read/);
      assert.equal(JSON.parse(fs.readFileSync(live(dir), 'utf8')).state.custom.length, 12, 'a refused restore changes nothing');
      assert.equal(restore(dir, '--latest').status, 0);
    });
  });

  // ---- through the real server ----
  const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
  const port = 4400 + Math.floor(Math.random() * 100), dir = tmp('bk-g-');
  const server = cp.spawn(process.execPath, [path.join(__dirname, 'server.cjs')], { env: { ...process.env, PORT: String(port), ORIENT_DATA_DIR: dir }, stdio: 'ignore' });
  const call = (method, p, headers = {}, body) => new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port, path: p, method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers } }, m => { let d = ''; m.on('data', c => d += c); m.on('end', () => res({ status: m.statusCode, body: d ? JSON.parse(d) : null })); }); r.on('error', rej); if (body) r.write(JSON.stringify(body)); r.end(); });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--host-resolver-rules=MAP orient.test 127.0.0.1'] });
  try {
    for (let i = 0; i < 50; i++) { try { await call('GET', '/api/backups'); break; } catch { await new Promise(r => setTimeout(r, 150)); } }
    await t('the server refuses backups to anything that looks like the tunnel, and sync shrinking the map leaves a safety copy', async () => {
      assert.equal((await call('GET', '/api/backups', { Host: 'grimoire.thealliedpeoplesunion.org' })).status, 403);
      assert.equal((await call('POST', '/api/backups', { 'cf-connecting-ip': '203.0.113.9' })).status, 403);
      assert.deepEqual((await call('GET', '/api/backups')).body.backups, []);
      assert.equal((await call('POST', '/api/backups')).status, 409, 'nothing to back up yet');
      const first = await call('PUT', '/api/state', {}, { baseRev: 0, state: map(30, 40) }); assert.equal(first.status, 200);
      const made = await call('POST', '/api/backups'); assert.equal(made.status, 200); assert.equal(made.body.ok, true);
      const shrink = await call('PUT', '/api/state', {}, { baseRev: first.body.rev, state: map(2) }); assert.equal(shrink.status, 200);
      const list = (await call('GET', '/api/backups')).body;
      const extra = list.backups.find(b => b.kind === 'before-change'); assert.ok(extra, 'a before-change copy exists'); assert.equal(extra.items, 70, 'it holds the map as it was');
      assert.equal(list.lastGood.ok, true);
    });
    const panel = async (origin, action) => {
      const page = await browser.newPage({ viewport: { width: 900, height: 900 } }); page.setDefaultTimeout(8000);
      await page.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' }));
      await page.addInitScript(() => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify({ version: 1, home: { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' }, useCatalog: false, custom: [], saved: [], visited: [] })); } });
      await page.goto(origin + ':' + port); await page.waitForFunction(() => window.OrientSync);
      await page.click('[data-action="settings"]'); await page.waitForTimeout(700);
      const out = { visible: await page.locator('#backup-box').isVisible(), text: await page.locator('#backup-box').innerText().catch(() => '') };
      if (action) await action(page, out);
      await page.close(); return out;
    };
    await t('Your field kit shows the last good backup and can make one now, only on this computer', async () => {
      const r = await panel('http://127.0.0.1', async (page, out) => {
        assert.match(out.text, /Last good backup/); assert.match(out.text, /1 daily copy and 1 safety copy/); assert.match(out.text, /data\/backups/);
        await page.getByRole('button', { name: 'Back up now', exact: true }).click(); await page.getByText('Backed up.').waitFor();
        await page.getByText('All copies', { exact: true }).click(); assert.match(await page.locator('.backup-list').innerText(), /Before a large change/);
      });
      assert.equal(r.visible, true);
      assert.equal((await panel('http://orient.test')).visible, false, 'hidden through the public address');
    });
    console.log('PASS: ' + n + ' backup cases');
  } finally { await browser.close(); server.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } }
})().catch(e => { console.error(e); process.exit(1); });
