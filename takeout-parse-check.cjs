// Offline check of the Google Takeout readers (no browser, no server):  node takeout-parse-check.cjs
// The fixtures follow Google's documented export shapes; they are not anyone's real data.
const assert = require('node:assert/strict');
const T = require('./public/takeout.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

const CSV = 'Title,Note,URL,Tags,Comment\r\n'
  + '7 Brew Coffee,"best drive-thru, ask for ""the kind""",https://www.google.com/maps/place/7+Brew+Coffee/data=!4m2!3m1!1s0x883c:0x1,,\r\n'
  + 'Glass City Metropark,,"https://www.google.com/maps/place/Glass+City+Metropark/@41.6511,-83.5342,17z/data=!3m1!4b1",,Great at dusk\r\n'
  + ',,https://www.google.com/maps/place/Toledo+Zoo+%26+Aquarium/data=!4m2,,\r\n'
  + ',,,,\r\n';
t('CSV lists: quotes, commas, names from the URL, coordinates from the URL', () => {
  const r = T.readFile('Want to go.csv', CSV);
  assert.equal(r.type, 'places'); assert.equal(r.list, 'Want to go'); assert.equal(r.items.length, 3);
  assert.equal(r.items[0].name, '7 Brew Coffee'); assert.equal(r.items[0].note, 'best drive-thru, ask for "the kind"'); assert.equal(r.items[0].coordinates, null);
  assert.deepEqual(r.items[1].coordinates, [-83.5342, 41.6511]); assert.equal(r.items[1].note, 'Great at dusk');
  assert.equal(r.items[2].name, 'Toledo Zoo & Aquarium');
});
t('a place URL with !3d!4d coordinates', () => assert.deepEqual(T.fromUrl('https://www.google.com/maps/place/X/data=!4m6!3m5!8m2!3d41.65!4d-83.53'), [-83.53, 41.65]));

const GEO = { type: 'FeatureCollection', features: [
  { type: 'Feature', geometry: { type: 'Point', coordinates: [-83.55, 41.66] }, properties: { Title: "Frank's Coffee", 'Google Maps URL': 'http://maps.google.com/?cid=1', Location: { Address: '1 Main St, Toledo, OH', 'Business Name': "Frank's Coffee" }, Comment: 'good' } },
  { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { Title: 'Ghost Pepper Grill', Location: { 'Geo Coordinates': { Latitude: '41.64', Longitude: '-83.57' } } } },
  { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { Title: 'Mystery spot', Location: {} } },
  { type: 'Feature', geometry: { type: 'Point', coordinates: [-83, 41] }, properties: {} } ] };
t('Saved Places GeoJSON: coordinates, fallbacks, and nameless features dropped', () => {
  const r = T.readFile('Saved Places.json', JSON.stringify(GEO));
  assert.equal(r.type, 'places'); assert.equal(r.list, 'Saved places'); assert.equal(r.items.length, 3);
  assert.deepEqual(r.items[0].coordinates, [-83.55, 41.66]); assert.equal(r.items[0].address, '1 Main St, Toledo, OH');
  assert.deepEqual(r.items[1].coordinates, [-83.57, 41.64]); assert.equal(r.items[2].coordinates, null);
});
t('Timeline: new phone export and the older monthly file', () => {
  const a = T.readFile('Timeline.json', JSON.stringify({ semanticSegments: [
    { startTime: '2026-09-20T09:14:00.000-04:00', endTime: 'x', visit: { topCandidate: { placeLocation: { latLng: '41.6535°, -83.5395°' } } } },
    { startTime: '2026-09-20T10:00:00.000-04:00', timelinePath: [] }, { startTime: 'bad', visit: { topCandidate: { placeLocation: { latLng: '41.1°, -83.1°' } } } } ] }));
  assert.equal(a.type, 'visits'); assert.deepEqual(a.items, [{ day: '2026-09-20', coordinates: [-83.5395, 41.6535] }]);
  const b = T.readFile('2026_SEPTEMBER.json', JSON.stringify({ timelineObjects: [{ placeVisit: { location: { latitudeE7: 416535000, longitudeE7: -835395000 }, duration: { startTimestamp: '2026-09-21T13:00:00Z' } } }, { activitySegment: {} }] }));
  assert.equal(b.type, 'visits'); assert.equal(b.items[0].day, '2026-09-21'); assert.ok(Math.abs(b.items[0].coordinates[1] - 41.6535) < 1e-6);
});
t('unrecognised or empty files are explained, not guessed at', () => {
  assert.equal(T.readFile('x.json', '{"a":1}').type, 'none'); assert.equal(T.readFile('x.json', 'nope').type, 'none'); assert.equal(T.readFile('x.csv', 'Title\r\n').type, 'none');
  assert.match(T.readFile('Records.json', JSON.stringify({ locations: [] })).why, /recognise/);
});
t('guessing a category from the name', () => {
  assert.equal(T.guessKind('7 Brew Coffee'), 'Food & drink'); assert.equal(T.guessKind('Glass City Metropark'), 'Public space');
  assert.equal(T.guessKind('Toledo Library'), 'Library'); assert.equal(T.guessKind('Acme Hardware'), 'Other');
});
console.log('PASS: ' + n + ' Takeout parsing cases');
