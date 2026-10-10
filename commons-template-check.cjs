// Offline check of the commons template (no browser, no network):  node commons-template-check.cjs
// Builds throwaway git repositories from commons-template/ and runs its tools the way the workflows do.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const TEMPLATE = path.join(__dirname, 'commons-template');
const D = require(path.join(TEMPLATE, 'tools', 'commons-data.js'));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

// ---- helpers ----
const git = (cwd, ...args) => cp.execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
function newRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'commons-'));
  fs.cpSync(TEMPLATE, dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main'); git(dir, 'config', 'user.email', 'maintainer@example.test'); git(dir, 'config', 'user.name', 'Maintainer');
  git(dir, 'config', 'commit.gpgsign', 'false');
  commit(dir, 'start');
  return dir;
}
const commit = (dir, msg) => { git(dir, 'add', '-A'); git(dir, 'commit', '-q', '--allow-empty', '-m', msg); };
const claim = (id, place, text, extra = {}) => ({ source_id: 'toledo-test', claim: { schema_version: 1, id, place_id: place, kind: 'seating', observation: text, source: { type: 'personal_observation' }, asserted_on: '2026-10-09', status: 'active', ...extra } });
const bundle = (places, claims, sourceId = 'toledo-test') => ({ format: 'orient-commons', schema_version: 1, sources: [{ id: sourceId, name: 'Test commons', license: 'CC-BY-4.0' }], places: places.map(([id, name, c]) => ({ source_id: sourceId, id, name, coordinates: c || [-83.539, 41.655] })), claims });
const put = (dir, file, value) => fs.writeFileSync(path.join(dir, 'contributions', file), JSON.stringify(value, null, 2) + '\n');
const build = dir => cp.spawnSync(process.execPath, [path.join(dir, 'tools', 'build-snapshot.cjs')], { cwd: dir, encoding: 'utf8' });
const validate = (dir, ...a) => cp.spawnSync(process.execPath, [path.join(dir, 'tools', 'validate.cjs'), ...a], { cwd: dir, encoding: 'utf8' });
const snap = (dir, name = 'snapshot.json') => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const claimOf = (s, id) => s.claims.find(c => c.claim.id === id)?.claim;

// ---- template integrity ----
t('the template carries Orient\'s own validator, unchanged', () => assert.equal(fs.readFileSync(path.join(TEMPLATE, 'tools', 'commons-data.js'), 'utf8'), fs.readFileSync(path.join(__dirname, 'public', 'commons-data.js'), 'utf8'), 'copy public/commons-data.js into commons-template/tools/'));
t('the workflows keep their safety properties', () => {
  const check = fs.readFileSync(path.join(TEMPLATE, '.github/workflows/check-contribution.yml'), 'utf8');
  assert.match(check, /on:\s*\n\s*pull_request:/); assert.doesNotMatch(check, /pull_request_target/);
  assert.match(check, /permissions:\s*\n\s*contents: read/); assert.match(check, /ref: \$\{\{ github\.base_ref \}\}\s*\n\s*path: trusted/);
  assert.match(check, /node trusted\/tools\/validate\.cjs/); assert.doesNotMatch(check, /secrets\./);
  const build = fs.readFileSync(path.join(TEMPLATE, '.github/workflows/build-snapshot.yml'), 'utf8');
  assert.match(build, /contents: write/); assert.doesNotMatch(build, /pull_request/); assert.match(build, /fetch-depth: 0/);
});

// ---- building the snapshot ----
t('an empty commons builds an empty, valid snapshot', () => {
  const dir = newRepo(); const r = build(dir); assert.equal(r.status, 0, r.stderr);
  const s = snap(dir); assert.deepEqual([s.sources.length, s.places.length, s.claims.length], [0, 0, 0]); D.validate(s);
});
t('contributions merge; a later one corrects, retires and re-pins, whatever the file names sort like', () => {
  const dir = newRepo();
  put(dir, 'zz-first.json', bundle([['bench', 'River bench', [-83.5, 41.6]], ['cafe', 'Corner cafe']], [claim('bench-seat', 'bench', 'Old text.'), claim('cafe-quiet', 'cafe', 'Quiet in the morning.')]));
  commit(dir, 'first');
  put(dir, 'aa-second.json', bundle([['bench', 'River bench', [-83.51, 41.61]]], [claim('bench-seat', 'bench', 'New text.')]));
  commit(dir, 'second');
  put(dir, 'mm-third.json', bundle([['cafe', 'Corner cafe']], [claim('cafe-quiet', 'cafe', 'Quiet in the morning.', { status: 'retired' })]));
  commit(dir, 'third');
  const r = build(dir); assert.equal(r.status, 0, r.stderr);
  const s = snap(dir);
  assert.equal(claimOf(s, 'bench-seat').observation, 'New text.', 'the later commit wins, not the later file name');
  assert.equal(claimOf(s, 'cafe-quiet').status, 'retired');
  assert.deepEqual(s.places.find(p => p.id === 'bench').coordinates, [-83.51, 41.61]);
  assert.equal(s.claims.length, 2); assert.equal(s.sources.length, 1); D.validate(s);
});
t('two commons in one repository stay separate', () => {
  const dir = newRepo();
  put(dir, 'a.json', bundle([['p', 'Place']], [{ ...claim('c1', 'p', 'From A.'), source_id: 'source-a' }], 'source-a')); commit(dir, 'a');
  put(dir, 'b.json', bundle([['p', 'Place']], [{ ...claim('c1', 'p', 'From B.'), source_id: 'source-b' }], 'source-b')); commit(dir, 'b');
  const s = (build(dir), snap(dir));
  assert.equal(s.claims.length, 2); assert.deepEqual(s.sources.map(x => x.id), ['source-a', 'source-b']); assert.equal(s.places.length, 2);
});
t('an invalid file is skipped and named, and does not stop the rest', () => {
  const dir = newRepo();
  put(dir, 'good.json', bundle([['p', 'Place']], [claim('c1', 'p', 'Fine.')]));
  fs.writeFileSync(path.join(dir, 'contributions', 'broken.json'), '{ not json');
  put(dir, 'private.json', { ...bundle([['p', 'Place']], [claim('c9', 'p', 'Sneaky.')]), visits: { p: ['2026-10-01'] } });
  commit(dir, 'files');
  const r = build(dir); assert.equal(r.status, 0);
  assert.match(r.stdout, /::warning file=contributions\/broken\.json::/); assert.match(r.stdout, /::warning file=contributions\/private\.json::/);
  assert.equal(snap(dir).claims.length, 1);
});
t('building twice gives identical files', () => {
  const dir = newRepo(); put(dir, 'a.json', bundle([['b', 'B'], ['a', 'A']], [claim('c2', 'b', 'Two.'), claim('c1', 'a', 'One.')])); commit(dir, 'a');
  build(dir); const first = fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8'); build(dir);
  assert.equal(fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8'), first);
});
t('a commons larger than Orient\'s limits is split into snapshots Orient accepts', () => {
  const dir = newRepo(); let total = 0;
  for (let f = 0; f < 3; f++) {
    const places = [], claims = [];
    for (let i = 0; i < 100; i++) { const id = 'p' + f + '-' + i; places.push([id, 'Place ' + f + '-' + i, [-83.5 + i / 1000, 41.6 + f / 100]]); claims.push(claim('c' + f + '-' + i + 'a', id, 'First observation.'), claim('c' + f + '-' + i + 'b', id, 'Second observation.')); total += 2; }
    put(dir, 'batch-' + f + '.json', bundle(places, claims)); commit(dir, 'batch ' + f);
  }
  const r = build(dir); assert.equal(r.status, 0, r.stderr);
  const one = snap(dir), two = snap(dir, 'snapshot-2.json'); D.validate(one); D.validate(two);
  assert.ok(one.places.length <= 180 && one.claims.length <= 450);
  assert.equal(one.claims.length + two.claims.length, total); assert.equal(one.places.length + two.places.length, 300);
  for (const s of [one, two]) for (const c of s.claims) assert.ok(s.places.some(p => p.id === c.claim.place_id), 'a place travels with its claims');
  assert.match(r.stdout, /snapshot-2\.json/);
  fs.rmSync(path.join(dir, 'contributions', 'batch-1.json')); fs.rmSync(path.join(dir, 'contributions', 'batch-2.json')); commit(dir, 'prune');
  build(dir); assert.equal(fs.existsSync(path.join(dir, 'snapshot-2.json')), false, 'a shard that is no longer needed is removed');
});

// ---- checking a pull request ----
function prRepo() {
  const dir = newRepo();
  put(dir, 'existing.json', bundle([['p', 'Existing place']], [claim('c1', 'p', 'Already here.')])); commit(dir, 'existing');
  git(dir, 'checkout', '-q', '-b', 'pr');
  return dir;
}
t('a valid new contribution passes and is laid out for the maintainer', () => {
  const dir = prRepo(); put(dir, 'new.json', bundle([['q', 'New | place']], [claim('c2', 'q', 'A useful observation.')])); commit(dir, 'add');
  const r = validate(dir, '--base', 'main'); assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /Valid\. 1 observation/); assert.match(r.stdout, /openstreetmap\.org\/\?mlat=41\.655&mlon=-83\.539/); assert.match(r.stdout, /New \\\| place/);
});
t('editing or deleting an existing contribution is refused', () => {
  const dir = prRepo(); put(dir, 'existing.json', bundle([['p', 'Existing place']], [claim('c1', 'p', 'Changed.')])); commit(dir, 'edit');
  let r = validate(dir, '--base', 'main'); assert.equal(r.status, 1); assert.match(r.stdout, /append-only/);
  git(dir, 'reset', '-q', '--hard', 'main'); fs.rmSync(path.join(dir, 'contributions', 'existing.json')); commit(dir, 'delete');
  r = validate(dir, '--base', 'main'); assert.equal(r.status, 1); assert.match(r.stdout, /append-only/);
});
t('changes outside contributions/ are refused, including to the checking code itself', () => {
  const dir = prRepo(); put(dir, 'new.json', bundle([['q', 'Q']], [claim('c2', 'q', 'Fine.')])); fs.appendFileSync(path.join(dir, 'tools', 'validate.cjs'), '\n// loosened\n'); commit(dir, 'sneaky');
  const r = validate(dir, '--base', 'main'); assert.equal(r.status, 1); assert.match(r.stdout, /::error file=tools\/validate\.cjs::A contribution should only add files under contributions\//);
});
t('an invalid bundle, a private-map export and an empty bundle are refused', () => {
  for (const [name, value] of [['bad.json', { ...bundle([['q', 'Q']], [claim('c2', 'q', 'Fine.')]), neighbors: [{ name: 'x' }] }], ['empty.json', bundle([], [])], ['dangling.json', bundle([['q', 'Q']], [claim('c2', 'zzz', 'No such place.')])]]) {
    const dir = prRepo(); put(dir, name, value); commit(dir, 'bad'); const r = validate(dir, '--base', 'main');
    assert.equal(r.status, 1, name + ' should fail: ' + r.stdout);
  }
});
t('personal details and replacements are flagged for a human without failing the check', () => {
  const dir = prRepo();
  put(dir, 'new.json', bundle([['p', 'Existing place'], ['q', 'Q']], [claim('c1', 'p', 'Replaces the old one.'), claim('c3', 'q', 'Ask for Sam at sam@example.com or 419 555 0100.'), claim('c4', 'q', 'My landlord likes it here.')]));
  commit(dir, 'add');
  const r = validate(dir, '--base', 'main'); assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /::warning file=contributions\/new\.json::Observation "c3" looks like an email address/);
  assert.match(r.stdout, /Observation "c3" looks like a phone number/); assert.match(r.stdout, /Observation "c4" may describe a specific person/);
  assert.match(r.stdout, /Observation "c1" from source "toledo-test" already exists and would be replaced/);
  assert.match(r.stdout, /\(replaces an existing observation\)/);
});
t('moving an existing place\'s pin is flagged', () => {
  const dir = prRepo(); put(dir, 'new.json', bundle([['p', 'Existing place', [-83.4, 41.5]]], [claim('c5', 'p', 'New thought.')])); commit(dir, 'add');
  const r = validate(dir, '--base', 'main'); assert.equal(r.status, 0); assert.match(r.stdout, /Place "p" would move to a new map pin/);
});
t('a pull request with no changes fails; checking files directly works', () => {
  const dir = prRepo(); assert.equal(validate(dir, '--base', 'main').status, 1);
  put(dir, 'direct.json', bundle([['q', 'Q']], [claim('c2', 'q', 'Fine.')])); assert.equal(validate(dir, 'contributions/direct.json').status, 0);
});
t('a contribution cannot neuter its own checks: the trusted copy of the tools still catches it', () => {
  const dir = prRepo();
  fs.writeFileSync(path.join(dir, 'tools', 'validate.cjs'), 'process.exit(0);\n');
  put(dir, 'evil.json', { ...bundle([['q', 'Q']], [claim('c2', 'q', 'Fine.')]), extra: true }); commit(dir, 'evil');
  assert.equal(validate(dir, '--base', 'main').status, 0, 'the pull request\'s own, gutted, validator waves it through');
  const trusted = cp.spawnSync(process.execPath, [path.join(TEMPLATE, 'tools', 'validate.cjs'), '--base', 'main'], { cwd: dir, encoding: 'utf8' });
  assert.equal(trusted.status, 1); assert.match(trusted.stdout, /::error file=contributions\/evil\.json::/); assert.match(trusted.stdout, /::error file=tools\/validate\.cjs::/);
});
console.log('PASS: ' + n + ' commons template cases');
