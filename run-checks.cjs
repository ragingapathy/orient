// Runs Orient's checks (the *-check.cjs files) against a test server of its own, with sync off and an empty data folder, so nothing
// touches your real map. One command:
//     node run-checks.cjs                  every check
//     node run-checks.cjs spend icons      just those
//     node run-checks.cjs --list           what there is
//     node run-checks.cjs --jobs 3         three at a time (faster; a few checks start servers of their own, so 1 is the safest)
// Needs Playwright with Chrome: install it (npm i playwright) or point ORIENT_PLAYWRIGHT at an existing playwright folder.
// A check that prints "SKIP:" (for example one that needs a private catalog) counts as skipped, not failed.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { spawn } = require('node:child_process');

const args = process.argv.slice(2);
const jobsAt = args.indexOf('--jobs'), jobs = jobsAt >= 0 ? Math.max(1, Number(args[jobsAt + 1]) || 1) : 1;
const names = args.filter((a, i) => !a.startsWith('--') && !(jobsAt >= 0 && i === jobsAt + 1));
const all = fs.readdirSync(__dirname).filter(f => /-check\.cjs$/.test(f)).sort();
if (args.includes('--list')) { console.log(all.map(f => f.replace(/-check\.cjs$/, '')).join('\n')); process.exit(0); }
const wanted = names.length ? names.map(n => { const f = n.replace(/(-check)?(\.cjs)?$/, '') + '-check.cjs'; if (!all.includes(f)) { console.error('No check called ' + n); process.exit(2); } return f; }) : all;

function findPlaywright() {
  if (process.env.ORIENT_PLAYWRIGHT) return process.env.ORIENT_PLAYWRIGHT;
  try { return path.dirname(require.resolve('playwright/package.json')); } catch { /* not installed here */ }
  const codex = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  return fs.existsSync(codex) ? codex : '';
}
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const ready = url => new Promise((resolve, reject) => {
  const t0 = Date.now();
  const tick = () => http.get(url, r => { r.resume(); resolve(); }).on('error', () => Date.now() - t0 > 15000 ? reject(new Error('the test server did not start')) : setTimeout(tick, 200));
  tick();
});

(async () => {
  const playwright = findPlaywright();
  if (!playwright) { console.error('Playwright was not found. Run: npm i playwright  (or set ORIENT_PLAYWRIGHT to a playwright folder).'); process.exit(2); }
  fs.mkdirSync(path.join(__dirname, 'output', 'playwright'), { recursive: true });
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'orient-checks-'));
  const port = await freePort(), url = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['server.cjs'], { cwd: __dirname, env: { ...process.env, PORT: String(port), ORIENT_SYNC: 'off', ORIENT_DATA_DIR: data }, stdio: 'ignore' });
  const stop = () => { try { server.kill(); } catch { /* already gone */ } try { fs.rmSync(data, { recursive: true, force: true }); } catch { /* temp */ } };
  process.on('exit', stop); process.on('SIGINT', () => process.exit(130));
  await ready(url);

  const results = [];
  const run = file => new Promise(resolve => {
    const t0 = Date.now(); let out = '';
    const child = spawn(process.execPath, [file], { cwd: __dirname, env: { ...process.env, ORIENT_URL: url, ORIENT_PLAYWRIGHT: playwright } });
    const timer = setTimeout(() => { out += '\n[timed out after 4 minutes]'; child.kill(); }, 240000);
    child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
    child.on('close', code => {
      clearTimeout(timer);
      const status = code === 0 ? (/^SKIP:/m.test(out) && !/^(PASS|ok)/m.test(out) ? 'skip' : 'pass') : 'fail';
      const r = { name: file.replace(/-check\.cjs$/, ''), status, seconds: Math.round((Date.now() - t0) / 100) / 10, out };
      results.push(r); console.log(({ pass: 'pass', fail: 'FAIL', skip: 'skip' })[status] + '  ' + r.name + '  (' + r.seconds + 's)');
      if (status === 'fail') console.log(out.trim().split('\n').slice(0, 8).map(l => '      ' + l.slice(0, 200)).join('\n'));
      resolve();
    });
  });
  const queue = wanted.slice();
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => { while (queue.length) await run(queue.shift()); }));

  const count = s => results.filter(r => r.status === s).length;
  console.log(`\n${count('pass')} passed, ${count('fail')} failed, ${count('skip')} skipped, of ${results.length}.`);
  if (count('fail')) console.log('Failed: ' + results.filter(r => r.status === 'fail').map(r => r.name).join(' '));
  process.exit(count('fail') ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
