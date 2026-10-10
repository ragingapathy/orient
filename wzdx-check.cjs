// The WZDx reader (commons-template/tools/wzdx.cjs) and the road-work fetch tool, offline:  node wzdx-check.cjs
// Fixtures are made up in the shape of the national WZDx 4.x feed; nothing real is contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const http = require('node:http');
const { normalize, statusOf, thin } = require('./commons-template/tools/wzdx.cjs');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

const NOW = new Date('2026-10-10T12:00:00Z');
const BOX = [-84.3, 41.2, -82.7, 42.1];
const feature = (id, over = {}, core = {}) => ({
  type: 'Feature', id,
  properties: {
    core_details: { event_type: 'work-zone', data_source_id: 'ohgo', road_names: ['I-75'], direction: 'northbound', description: 'Bridge deck repair', update_date: '2026-10-10T11:00:00Z', ...core },
    start_date: '2026-10-01T00:00:00Z', end_date: '2026-11-01T00:00:00Z', vehicle_impact: 'some-lanes-closed', beginning_cross_street: 'Manhattan Blvd', ending_cross_street: 'Alexis Rd', ...over,
  },
  geometry: { type: 'LineString', coordinates: [[-83.55, 41.7], [-83.54, 41.71], [-83.53, 41.72]] },
});
const feed = (...features) => ({ type: 'FeatureCollection', features });

(async () => {
  await t('a WZDx 4.x feature becomes a plain item', () => {
    const { items } = normalize(feed(feature('a1')), { source: 'ohgo', bbox: BOX, now: NOW });
    assert.equal(items.length, 1); const i = items[0];
    assert.equal(i.id, 'ohgo:a1'); assert.deepEqual(i.roads, ['I-75']); assert.equal(i.direction, 'northbound'); assert.equal(i.status, 'restricted');
    assert.equal(i.description, 'Bridge deck repair'); assert.equal(i.from, 'Manhattan Blvd'); assert.equal(i.to, 'Alexis Rd');
    assert.equal(i.start, '2026-10-01T00:00:00.000Z'); assert.equal(i.end, '2026-11-01T00:00:00.000Z'); assert.equal(i.upcoming, false); assert.equal(i.geometry.length, 3);
  });
  await t('closures, restrictions and open lanes are told apart', () => {
    assert.deepEqual(['all-lanes-closed', 'some-lanes-closed', 'alternating-one-way', 'some-lanes-closed-merge-left', 'all-lanes-open', 'unknown', '', undefined].map(statusOf), ['closed', 'restricted', 'restricted', 'restricted', 'open', 'unknown', 'unknown', 'unknown']);
    const { items } = normalize(feed(feature('open', { vehicle_impact: 'all-lanes-open' }), feature('closed', { vehicle_impact: 'all-lanes-closed' }), feature('some')), { source: 'x', bbox: BOX, now: NOW });
    assert.deepEqual(items.map(i => i.status), ['closed', 'restricted', 'open'], 'worst first');
  });
  await t('the same data in PascalCase (as OHGO documents it) reads the same', () => {
    const p = feature('P1');
    const pascal = { Type: 'Feature', Id: 'P1', Properties: { CoreDetails: { EventType: 'work-zone', RoadNames: ['US 23'], Direction: 'southbound', Description: 'Resurfacing' }, StartDate: p.properties.start_date, EndDate: p.properties.end_date, VehicleImpact: 'all-lanes-closed' }, Geometry: { Type: 'LineString', Coordinates: p.geometry.coordinates } };
    const { items } = normalize(feed(pascal), { source: 'ohgo', bbox: BOX, now: NOW });
    assert.equal(items.length, 1); assert.equal(items[0].status, 'closed'); assert.deepEqual(items[0].roads, ['US 23']); assert.equal(items[0].id, 'ohgo:P1');
  });
  await t('finished, far-off, outside-the-area and broken items are left out, and counted', () => {
    const { items, skipped } = normalize(feed(
      feature('over', { end_date: '2026-09-01T00:00:00Z' }), feature('later', { start_date: '2026-12-25T00:00:00Z', end_date: '2027-01-02T00:00:00Z' }), feature('soon', { start_date: '2026-10-12T00:00:00Z' }),
      { ...feature('elsewhere'), geometry: { type: 'LineString', coordinates: [[-81.7, 41.5], [-81.6, 41.5]] } }, { ...feature('nogeo'), geometry: null }, { ...feature('bad'), geometry: { type: 'LineString', coordinates: [['x', 1]] } },
      feature('detour-ok', {}, { event_type: 'detour' }), feature('incident', {}, { event_type: 'incident' }), null, 'junk'), { source: 'ohgo', bbox: BOX, now: NOW });
    assert.deepEqual(items.map(i => i.id).sort(), ['ohgo:detour-ok', 'ohgo:soon']);
    assert.equal(items.find(i => i.id === 'ohgo:soon').upcoming, true);
    assert.deepEqual(skipped, { badGeometry: 4, outsideArea: 1, over: 1, tooFar: 1, notRoadWork: 1 });
  });
  await t('output is bounded and clean: long lines thinned, text trimmed and stripped, points validated', () => {
    const long = { ...feature('long'), geometry: { type: 'LineString', coordinates: Array.from({ length: 500 }, (_, k) => [-83.5 + k * 1e-4, 41.7]) } };
    const nasty = feature('nasty', {}, { description: '  Lane\u0000 closed\n\n<script>alert(1)</script> ' + 'x'.repeat(400), road_names: ['I-75', 5, null, '  '] });
    const { items } = normalize(feed(long, nasty), { source: 's', bbox: BOX, now: NOW });
    const l = items.find(i => i.id === 's:long'), a = items.find(i => i.id === 's:nasty');
    assert.equal(l.geometry.length, 40); assert.deepEqual(l.geometry[0], [-83.5, 41.7]); assert.deepEqual(l.geometry[39], [-83.4501, 41.7]);
    assert.ok(a.description.length <= 260 && !/[\u0000\n]/.test(a.description)); assert.deepEqual(a.roads, ['I-75']);
    assert.equal(thin([[0, 0], [1, 1]]).length, 2);
    const many = normalize(feed(...Array.from({ length: 700 }, (_, k) => feature('m' + k))), { source: 's', bbox: BOX, now: NOW, max: 600 }); assert.equal(many.items.length, 600);
  });
  await t('the fetch tool writes roadwork.json, sends the key as the feed asks, keeps a failed feed\'s last good data for six hours, never prints the key and skips a feed with no key', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roadwork-')); const SECRET = 'sekrit-key-123';
    let seen = null, mode = 'ok';
    const server = http.createServer((req, res) => { seen = req.headers.authorization; if (mode === 'fail') { res.statusCode = 503; return res.end('no'); } res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(feed(feature('live1'), feature('live2', { vehicle_impact: 'all-lanes-closed' })))); });
    await new Promise(r => server.listen(0, '127.0.0.1', r)); const url = 'http://127.0.0.1:' + server.address().port + '/wzdx';
    const config = { name: 'Test', bbox: BOX, feeds: [{ id: 'ohgo', name: 'Ohio', url, auth: { secretEnv: 'TEST_KEY', header: 'Authorization', prefix: 'APIKEY ' } }, { id: 'nokey', name: 'Needs a key', url, auth: { secretEnv: 'MISSING_KEY' } }, { id: 'open', name: 'Open feed', url }] };
    fs.writeFileSync(path.join(dir, 'cfg.json'), JSON.stringify(config));
    const tool = path.join(__dirname, 'commons-template', 'tools', 'fetch-roadwork.cjs');
    const run = () => new Promise(res => { const c = cp.spawn(process.execPath, [tool, '--config', path.join(dir, 'cfg.json'), '--previous', path.join(dir, 'previous.json'), '--out', path.join(dir, 'roadwork.json')], { env: { ...process.env, TEST_KEY: SECRET, MISSING_KEY: '' } }); let o = ''; c.stdout.on('data', d => o += d); c.stderr.on('data', d => o += d); c.on('close', code => res({ status: code, out: o })); });
    const first = await run(); assert.equal(first.status, 0, first.out);
    const out1 = JSON.parse(fs.readFileSync(path.join(dir, 'roadwork.json'), 'utf8'));
    assert.equal(out1.format, 'orient-roadwork'); assert.equal(out1.version, 1);
    assert.deepEqual(out1.sources.map(s => s.id + ':' + s.status), ['ohgo:ok', 'nokey:skipped', 'open:ok']);
    assert.equal(out1.items.filter(i => i.source === 'ohgo').length, 2);
    assert.equal((first.out + JSON.stringify(out1)).includes(SECRET), false, 'the key is nowhere in the output');
    fs.copyFileSync(path.join(dir, 'roadwork.json'), path.join(dir, 'previous.json')); mode = 'fail'; // now the feed breaks: the last good data stays, marked stale
    const second = await run(); assert.equal(second.status, 0, second.out);
    const out2 = JSON.parse(fs.readFileSync(path.join(dir, 'roadwork.json'), 'utf8'));
    assert.equal(out2.sources.find(s => s.id === 'ohgo').status, 'stale'); assert.equal(out2.items.filter(i => i.source === 'ohgo').length, 2);
    const old = JSON.parse(fs.readFileSync(path.join(dir, 'previous.json'), 'utf8')); old.sources.forEach(s => { if (s.fetched) s.fetched = new Date(Date.now() - 7 * 3600e3).toISOString(); }); fs.writeFileSync(path.join(dir, 'previous.json'), JSON.stringify(old)); // ... but not forever
    await run(); const out3 = JSON.parse(fs.readFileSync(path.join(dir, 'roadwork.json'), 'utf8'));
    assert.equal(out3.sources.find(s => s.id === 'ohgo').status, 'failed'); assert.equal(out3.items.filter(i => i.source === 'ohgo').length, 0);
    server.close();
  });
  await t('an api key is sent in the header the feed names, and nowhere else', async () => {
    const { fetchFeed } = require('./commons-template/tools/fetch-roadwork.cjs'); let h = null, url = null;
    const server = http.createServer((req, res) => { h = req.headers.authorization; url = req.url; res.setHeader('content-type', 'application/json'); res.end('{"features":[]}'); });
    await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + server.address().port + '/f';
    await fetchFeed({ url: base, auth: { secretEnv: 'K', header: 'Authorization', prefix: 'APIKEY ' } }, 'abc'); assert.equal(h, 'APIKEY abc'); assert.equal(url, '/f');
    await fetchFeed({ url: base, auth: { secretEnv: 'K', style: 'query', param: 'api-key' } }, 'abc'); assert.equal(url, '/f?api-key=abc');
    assert.deepEqual(await fetchFeed({ url: base, auth: { secretEnv: 'K' } }, ''), { skipped: 'no key set (K)' }); server.close();
  });
  await t('the workflow is scheduled, never runs for pull requests, and only publishes its own branch', () => {
    const w = fs.readFileSync(path.join(__dirname, 'commons-template', '.github', 'workflows', 'roadwork.yml'), 'utf8');
    assert.match(w, /schedule:/); assert.doesNotMatch(w, /pull_request/); assert.match(w, /contents: write/); assert.match(w, /roadwork-data/); assert.match(w, /secrets\.OHGO_API_KEY/);
    assert.doesNotMatch(w, /echo .*secrets/i); assert.match(w, /--force/);
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'commons-template', 'roadwork.config.json'), 'utf8'));
    assert.equal(cfg.feeds[0].auth.secretEnv, 'OHGO_API_KEY'); assert.equal(cfg.feeds[0].url, 'https://publicapi.ohgo.com/api/work-zones/wzdx/4.2'); assert.equal(cfg.bbox.length, 4);
  });
  console.log('PASS: ' + n + ' WZDx road-work cases');
})().catch(e => { console.error(e); process.exit(1); });
