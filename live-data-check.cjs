// The live city data tools (commons-template/tools): OHGO cameras and incidents, plate readers from OpenStreetMap, and the builder
// that publishes them, offline:  node live-data-check.cjs
// Everything is served by throwaway local servers with made-up data; nothing real is contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const ohgo = require('./commons-template/tools/ohgo.cjs');
const alpr = require('./commons-template/tools/alpr.cjs');
const { buildCivic } = require('./commons-template/tools/fetch-live.cjs');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

const BOX = [-84.3, 41.2, -82.7, 42.1];
const camera = (id, lat, lng, views, extra = {}) => ({ Id: id, Latitude: lat, Longitude: lng, Location: 'I-75 at Manhattan Blvd', Description: 'Fixed camera, southbound', CameraViews: views, ...extra });
const view = (dir, small, large) => ({ Direction: dir, SmallUrl: small, LargeUrl: large, MainRoute: 'I-75' });
const incident = (id, lat, lng, status, extra = {}) => ({ Id: id, Latitude: lat, Longitude: lng, Location: 'I-475 at SR 2', Description: 'Crash blocking the right lane', Category: 'Crash', Direction: 'Westbound', RouteName: 'I-475', RoadStatus: status, ...extra });
const node = (id, lat, lon, tags) => ({ type: 'node', id, lat, lon, tags: { man_made: 'surveillance', 'surveillance:type': 'ALPR', ...tags } });

(async () => {
  await t('cameras: sites with pictures are kept, in the area, over https, trimmed', () => {
    const items = ohgo.normalizeCameras([
      camera('c1', 41.70, -83.55, [view('Southbound', 'https://ohgo.example/small/c1.jpg', 'https://ohgo.example/large/c1.jpg'), view('PTZ', '', ''), view('Northbound', 'http://insecure.example/x.jpg', '')]),
      camera('c2', 41.60, -83.50, [view('Eastbound', 'https://ohgo.example/small/c2.jpg', '')]),
      camera('far', 40.00, -83.00, [view('N', 'https://ohgo.example/far.jpg', '')]),
      camera('noview', 41.65, -83.50, []), camera('badpos', 'x', null, [view('N', 'https://ohgo.example/a.jpg', '')]), null, 'junk',
      camera('ctl', 41.62, -83.51, [view('N', 'https://ohgo.example/n.jpg', '')], { Location: '  I-80\u0000 at\n SR 20 ' + 'x'.repeat(300) }),
    ], { bbox: BOX });
    assert.deepEqual(items.map(i => i.id), ['ohgo:c1', 'ohgo:c2', 'ohgo:ctl']);
    assert.deepEqual(items[0].views, [{ direction: 'Southbound', route: 'I-75', small: 'https://ohgo.example/small/c1.jpg', large: 'https://ohgo.example/large/c1.jpg' }], 'a view with no picture and an insecure address are dropped');
    assert.ok(items[2].location.length <= 120 && !/[\u0000\n]/.test(items[2].location));
    assert.equal(ohgo.normalizeCameras([camera('snake', 41.7, -83.5, [])].map(() => ({ id: 's', latitude: 41.7, longitude: -83.5, camera_views: [{ direction: 'N', small_url: 'https://x.example/s.jpg' }] }))).length, 1, 'snake_case works too');
  });
  await t('incidents: status, route and a closure line are read; closed comes first; long lines are thinned', () => {
    const poly = Array.from({ length: 100 }, (_, k) => [-83.5 + k * 1e-3, 41.7]);
    const items = ohgo.normalizeIncidents([
      incident('i1', 41.7, -83.5, 'Open'), incident('i2', 41.71, -83.51, 'Closed', { RoadClosureDetails: { Polyline: poly, ClosureStartLocation: [-83.5, 41.7] } }), incident('i3', 41.72, -83.52, 'Partially Closed'),
      incident('i4', 41.73, -83.53, undefined), incident('far', 35, -80, 'Closed'), incident('bad', 'x', 'y', 'Closed'),
    ], { bbox: BOX });
    assert.deepEqual(items.map(i => i.id + ':' + i.status), ['ohgo:i2:closed', 'ohgo:i3:partial', 'ohgo:i4:unknown', 'ohgo:i1:open']);
    const closed = items[0]; assert.equal(closed.polyline.length, 30); assert.deepEqual(closed.polyline[0], [-83.5, 41.7]); assert.equal(closed.route, 'I-475'); assert.equal(closed.direction, 'westbound'); assert.equal(closed.category, 'Crash');
  });
  await t('plate readers: degrees, compass points and lists read; tags are trimmed; ids sort', () => {
    assert.deepEqual(['345', '90;270', 'NE', 'north-west', 'sw', '', undefined, '361', 'garbage', ' 180 '].map(alpr.bearing), [345, 90, 45, null, 225, null, null, 1, null, 180]);
    const items = alpr.normalize([
      node(11, 41.59, -83.73, { direction: '345', manufacturer: 'Flock Safety', operator: "Lucas County Sheriff's Office", 'surveillance:zone': 'traffic', 'camera:mount': 'post', 'camera:type': 'fixed' }),
      node(2, 41.6, -83.7, { 'camera:direction': 'NE', brand: 'Genetec' }), node(3, 41.61, -83.71, {}), { type: 'way', id: 5, lat: 1, lon: 1 }, node(4, 'x', 1, {}), node(5, 95, 0, {}), null,
    ]);
    assert.deepEqual(items.map(i => i.id), ['osm:node/2', 'osm:node/3', 'osm:node/11'], 'numeric id order, junk and non-nodes dropped');
    assert.equal(items[2].direction, 345); assert.equal(items[2].manufacturer, 'Flock Safety'); assert.equal(items[2].operator, "Lucas County Sheriff's Office"); assert.equal(items[2].zone, 'traffic'); assert.equal(items[0].direction, 45); assert.equal(items[0].manufacturer, 'Genetec'); assert.equal(items[1].direction, null);
    assert.match(alpr.query(BOX), /surveillance:type"="ALPR"/); assert.match(alpr.query(BOX), /41\.2,-84\.3,42\.1,-82\.7/, 'south, west, north, east, as Overpass wants');
  });

  // ---- the builder, against local servers ----
  const SECRET = 'sekrit-ohgo-key';
  const state = { mode: 'ok', calls: { cameras: 0, incidents: 0, wzdx: 0, overpass: 0 }, auth: [], urls: [] };
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', d => body += d); req.on('end', () => {
      const u = new URL(req.url, 'http://x'); state.auth.push(req.headers.authorization || ''); state.urls.push(req.url);
      const json = o => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
      if (state.mode === 'fail') { res.statusCode = 503; return res.end('no'); }
      if (u.pathname === '/api/v1/cameras') { state.calls.cameras++; return json({ links: [], results: [camera('c1', 41.7, -83.55, [view('Southbound', 'https://ohgo.example/c1.jpg', 'https://ohgo.example/c1-large.jpg')])] }); }
      if (u.pathname === '/api/v1/incidents') { state.calls.incidents++; return json({ links: [], results: [incident('i1', 41.7, -83.5, 'Closed')] }); }
      if (u.pathname === '/wzdx') { state.calls.wzdx++; return json({ type: 'FeatureCollection', features: [{ type: 'Feature', id: 'w1', properties: { core_details: { event_type: 'work-zone', road_names: ['I-75'], direction: 'northbound', description: 'Bridge work' }, start_date: '2026-10-01T00:00:00Z', end_date: '2027-01-01T00:00:00Z', vehicle_impact: 'all-lanes-closed' }, geometry: { type: 'LineString', coordinates: [[-83.55, 41.7], [-83.54, 41.71]] } }] }); }
      if (u.pathname === '/overpass') { state.calls.overpass++; return json({ elements: [node(1, 41.6, -83.7, { direction: '90', manufacturer: 'Flock Safety', operator: 'Toledo Police Department' })] }); }
      res.statusCode = 404; res.end('nope');
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + server.address().port;
  const config = { name: 'Test', bbox: BOX, wzdx: { feeds: [{ id: 'ohgo', name: 'Ohio', url: base + '/wzdx', auth: { secretEnv: 'OHGO_API_KEY', header: 'Authorization', prefix: 'APIKEY ' } }] }, ohgo: { base, secretEnv: 'OHGO_API_KEY', cameras: true, incidents: true }, alpr: { enabled: true, minHours: 20, pauseMs: 1 } };
  const run = (over = {}) => buildCivic({ config, previousDir: over.previousDir || null, now: over.now || new Date(), env: over.env || { OHGO_API_KEY: SECRET }, overpassEndpoints: [base + '/overpass'] });
  const save = (files, dir) => { fs.mkdirSync(dir, { recursive: true }); for (const [k, v] of Object.entries(files)) fs.writeFileSync(path.join(dir, k), JSON.stringify(v)); return dir; };

  await t('the builder makes all four files, sends the key as OHGO asks, asks for the region only, and never prints the key', async () => {
    const files = await run();
    assert.deepEqual(Object.keys(files).sort(), ['alpr.json', 'cameras.json', 'incidents.json', 'roadwork.json']);
    assert.equal(files['roadwork.json'].items.length, 1); assert.equal(files['cameras.json'].items.length, 1); assert.equal(files['incidents.json'].items[0].status, 'closed'); assert.equal(files['alpr.json'].items[0].direction, 90);
    assert.equal(files['cameras.json'].format, 'orient-cameras'); assert.equal(files['alpr.json'].source.license, 'ODbL-1.0'); assert.equal(files['alpr.json'].source.attribution, '© OpenStreetMap contributors');
    assert.ok(state.auth.filter(a => a).every(a => a === 'APIKEY ' + SECRET), 'the key goes in the Authorization header');
    const cam = state.urls.find(u => u.startsWith('/api/v1/cameras')); assert.match(cam, /map-bounds-sw=41\.2%2C-84\.3/); assert.match(cam, /map-bounds-ne=42\.1%2C-82\.7/); assert.match(cam, /page-all=true/); assert.equal(cam.includes(SECRET), false, 'never in a URL');
    assert.equal(JSON.stringify(files).includes(SECRET), false, 'never in the published files');
  });
  await t('with no key, the OHGO files are skipped but the plate readers still publish', async () => {
    const files = await run({ env: {} });
    assert.equal(files['cameras.json'].source.status, 'skipped'); assert.equal(files['incidents.json'].source.status, 'skipped'); assert.equal(files['roadwork.json'].sources[0].status, 'skipped');
    assert.equal(files['alpr.json'].source.status, 'ok'); assert.deepEqual(files['cameras.json'].items, []);
  });
  await t('a failing source keeps its last good data for a while, then lets go; plate readers only refresh daily', async () => {
    const good = await run(); const dir = save(good, fs.mkdtempSync(path.join(os.tmpdir(), 'civic-')));
    state.mode = 'fail'; state.calls = { cameras: 0, incidents: 0, wzdx: 0, overpass: 0 };
    const soon = await run({ previousDir: dir, now: new Date(Date.now() + 2 * 3600e3) });
    assert.equal(soon['incidents.json'].source.status, 'stale'); assert.equal(soon['incidents.json'].items.length, 1); assert.equal(soon['cameras.json'].source.status, 'stale'); assert.equal(soon['roadwork.json'].sources[0].status, 'stale');
    assert.equal(state.calls.overpass, 0, 'the plate readers were refreshed within the day, so Overpass is left alone'); assert.equal(soon['alpr.json'].items.length, 1);
    const later = await run({ previousDir: dir, now: new Date(Date.now() + 8 * 3600e3) });
    assert.equal(later['incidents.json'].source.status, 'failed'); assert.deepEqual(later['incidents.json'].items, [], 'incidents are dropped after six hours');
    assert.equal(later['cameras.json'].source.status, 'stale', 'cameras barely change, so they are kept for three days');
    const tomorrow = await run({ previousDir: dir, now: new Date(Date.now() + 25 * 3600e3) });
    assert.equal(tomorrow['alpr.json'].source.status, 'stale', 'a day later Overpass is asked again, and if it fails the last file is kept'); assert.equal(tomorrow['alpr.json'].items.length, 1);
    state.mode = 'ok';
  });
  await t('the workflow publishes all four files from its own branch and nothing runs for pull requests', () => {
    const w = fs.readFileSync(path.join(__dirname, 'commons-template', '.github', 'workflows', 'live.yml'), 'utf8');
    for (const f of ['roadwork', 'incidents', 'cameras', 'alpr']) assert.ok(w.includes(f), f);
    assert.match(w, /node tools\/fetch-live\.cjs --previous-dir previous --out-dir out/); assert.doesNotMatch(w, /pull_request/);
  });
  server.close();
  console.log('PASS: ' + n + ' live data cases');
})().catch(e => { console.error(e); process.exit(1); });
