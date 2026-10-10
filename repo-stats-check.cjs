// Clone-count archive, its endpoint and its panel.  ORIENT_PLAYWRIGHT=<folder> node repo-stats-check.cjs
// Fictional numbers, a fake GitHub, and servers on temporary data folders. Nothing real is read or sent.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const S = require('./repo-stats.cjs');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

const fresh = (days, stars = 3) => ({ stars, forks: 1, watchers: 2,
  clones: { count: days.reduce((a, d) => a + d[1], 0), uniques: 2, clones: days.map(([d, c, u]) => ({ timestamp: d + 'T00:00:00Z', count: c, uniques: u })) },
  views: { count: 5, uniques: 2, views: [{ timestamp: days[0][0] + 'T00:00:00Z', count: 5, uniques: 2 }] } });

(async () => {
  await t('merging keeps days that have fallen out of GitHub\'s 14-day window and refreshes the ones it still reports', () => {
    let a = S.merge({ repos: {} }, 'me/app', fresh([['2026-10-01', 4, 2], ['2026-10-02', 1, 1]]), new Date('2026-10-03T00:00:00Z'));
    a = S.merge(a, 'me/app', fresh([['2026-10-02', 3, 2], ['2026-10-20', 7, 5]]), new Date('2026-10-21T00:00:00Z'));
    assert.deepEqual(Object.keys(a.repos['me/app'].days), ['2026-10-01', '2026-10-02', '2026-10-20']);
    assert.equal(a.repos['me/app'].days['2026-10-01'].clones, 4, 'an old day is kept');
    assert.equal(a.repos['me/app'].days['2026-10-02'].clones, 3, 'a reported day is refreshed');
    const s = S.summarize(a.repos['me/app']); assert.equal(s.clones, 14); assert.equal(s.since, '2026-10-01'); assert.equal(s.days, 3);
  });
  await t('repositories stay separate and the table lists them', () => {
    let a = S.merge({ repos: {} }, 'me/one', fresh([['2026-10-01', 2, 1]])); a = S.merge(a, 'me/two', fresh([['2026-10-01', 0, 0]], 0));
    const out = S.table(a); assert.match(out, /me\/one\s+2\s+2/); assert.match(out, /me\/two\s+0/);
  });
  await t('fetching reads GitHub\'s traffic endpoints and explains refusals', async () => {
    const calls = []; const ok = async (url, opts) => { calls.push(url); assert.match(opts.headers.Authorization, /^Bearer /); const body = /traffic\/clones/.test(url) ? fresh([['2026-10-01', 4, 2]]).clones : /traffic\/views/.test(url) ? fresh([['2026-10-01', 4, 2]]).views : { stargazers_count: 9, forks_count: 2, subscribers_count: 1 }; return { ok: true, status: 200, json: async () => body }; };
    const r = await S.fetchRepo('me/app', 'tok', ok); assert.equal(r.stars, 9); assert.equal(r.clones.count, 4); assert.equal(calls.length, 3);
    await assert.rejects(S.fetchRepo('me/app', 'tok', async () => ({ ok: false, status: 403, json: async () => ({}) })), /push access/);
    await assert.rejects(S.fetchRepo('me/app', 'tok', async () => ({ ok: false, status: 404, json: async () => ({}) })), /not found/);
  });

  // ---- the endpoint ----
  const port = 4300 + Math.floor(Math.random() * 100), withData = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-a-')), empty = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-b-'));
  const archive = S.merge(S.merge({ repos: {} }, 'me/orient', fresh([['2026-10-01', 12, 7], ['2026-10-02', 3, 2]], 4), new Date('2026-10-11T12:00:00Z')), 'me/toledo-commons', fresh([['2026-10-02', 1, 1]], 0), new Date('2026-10-11T12:00:00Z'));
  fs.writeFileSync(path.join(withData, 'repo-stats.json'), JSON.stringify(archive));
  const start = (p, dir) => spawn(process.execPath, [path.join(__dirname, 'server.cjs')], { env: { ...process.env, PORT: String(p), ORIENT_DATA_DIR: dir, ORIENT_SYNC: 'off' }, stdio: 'ignore' });
  const A = start(port, withData), B = start(port + 1, empty);
  const get = (p, headers = {}) => new Promise((res, rej) => { const r = http.get({ host: '127.0.0.1', port: p, path: '/api/repo-stats', headers }, m => { let d = ''; m.on('data', c => d += c); m.on('end', () => res({ status: m.statusCode, body: d })); }); r.on('error', rej); });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--host-resolver-rules=MAP orient.test 127.0.0.1'] });
  try {
    for (let i = 0; i < 50; i++) { try { await get(port); await get(port + 1); break; } catch { await new Promise(r => setTimeout(r, 150)); } }
    await t('the endpoint answers this computer, and refuses anything that looks like it came through the tunnel', async () => {
      const mine = await get(port); assert.equal(mine.status, 200); assert.equal(Object.keys(JSON.parse(mine.body).repos).length, 2);
      assert.equal((await get(port, { Host: 'grimoire.thealliedpeoplesunion.org' })).status, 403);
      assert.equal((await get(port, { 'cf-connecting-ip': '203.0.113.9' })).status, 403);
      assert.equal((await get(port, { 'x-forwarded-for': '203.0.113.9' })).status, 403);
      assert.deepEqual(JSON.parse((await get(port + 1)).body), { repos: {} }, 'no archive yet gives an empty answer');
    });
    const panel = async (origin, p) => {
      const page = await browser.newPage({ viewport: { width: 900, height: 900 } }); page.setDefaultTimeout(8000);
      await page.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' }));
      await page.addInitScript(() => { if (!sessionStorage.f) { sessionStorage.f = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify({ version: 1, home: { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' }, useCatalog: false, custom: [], saved: [], visited: [] })); } });
      await page.goto(origin + ':' + p); await page.waitForFunction(() => window.OrientSync);
      await page.click('[data-action="settings"]'); await page.waitForTimeout(700);
      const out = { visible: await page.locator('#stats-box').isVisible(), text: await page.locator('#stats-box').innerText().catch(() => '') }; await page.close(); return out;
    };
    await t('Your field kit shows the clone counts on this computer', async () => {
      const r = await panel('http://127.0.0.1', port); assert.equal(r.visible, true);
      assert.match(r.text, /Project stats/); assert.match(r.text, /orient[\s\S]*4 stars/); assert.match(r.text, /15[\s\S]*since 2026-10-01/); assert.match(r.text, /rough signal, not a head count/);
    });
    await t('it stays hidden when there is nothing recorded, and when opened from the public address', async () => {
      assert.equal((await panel('http://127.0.0.1', port + 1)).visible, false);
      assert.equal((await panel('http://orient.test', port)).visible, false);
    });
    console.log('PASS: ' + n + ' repository stats cases');
  } finally { await browser.close(); A.kill(); B.kill(); for (const d of [withData, empty]) try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }
})().catch(e => { console.error(e); process.exit(1); });
