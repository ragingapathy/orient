// Made-up live city data for the checks: incidents, traffic cameras and license plate readers, in the shapes the commons
// workflow publishes (commons-template/tools). Work zones come from roadwork-mock.cjs.
const { roadwork } = require('./roadwork-mock.cjs');
const src = (id, name, extra = {}) => ({ id, name, publisher: 'Ohio Department of Transportation', homepage: 'https://www.ohgo.com/', license: 'Public data from ODOT', status: 'ok', fetched: new Date().toISOString(), ...extra });
const incidents = () => ({ format: 'orient-incidents', version: 1, updated: new Date().toISOString(), source: src('ohgo', 'Ohio roads (OHGO)'), items: [
  { id: 'ohgo:i1', lat: 41.64, lng: -83.56, category: 'Crash', route: 'I-75', direction: 'northbound', location: 'I-75 at Manhattan Blvd', description: 'Crash blocking the right lane. Expect delays.', status: 'partial', polyline: [] },
  { id: 'ohgo:i2', lat: 41.66, lng: -83.50, category: 'Road closure', route: 'SR 2', direction: 'eastbound', location: 'SR 2 at Front St', description: 'Road closed for flooding. <img src=x onerror=alert(1)>', status: 'closed', polyline: [[-83.52, 41.66], [-83.50, 41.66], [-83.48, 41.665]] },
  { id: 'ohgo:i3', lat: 41.60, lng: -83.60, category: 'Debris', route: 'US 20', direction: '', location: 'US 20 near Holland', description: 'Debris on the shoulder.', status: 'open', polyline: [] },
] });
const camera = (n, lat, lng, views) => ({ id: 'ohgo:cam' + n, lat, lng, location: 'I-75 at Exit ' + n, description: 'Fixed camera', views });
const cameras = () => ({ format: 'orient-cameras', version: 1, updated: new Date().toISOString(), source: src('ohgo', 'Ohio roads (OHGO)'), items: [
  camera(1, 41.655, -83.545, [{ direction: 'Southbound', route: 'I-75', small: 'https://itscameras.example/images/toledo/c1-small.jpg', large: 'https://itscameras.example/images/toledo/c1.jpg' }, { direction: 'Northbound', route: 'I-75', small: 'https://itscameras.example/images/toledo/c1n-small.jpg', large: 'https://itscameras.example/images/toledo/c1n.jpg' }]),
  camera(2, 41.67, -83.58, [{ direction: 'View', route: 'SR 2', small: 'https://itscameras.example/images/toledo/c2.jpg', large: 'https://itscameras.example/images/toledo/c2.jpg' }]),
  camera(3, 41.62, -83.50, [{ direction: 'Eastbound', route: 'SR 25', small: 'https://itscameras.example/images/toledo/c3.jpg', large: '' }]),
  camera(4, 41.70, -83.52, [{ direction: 'View', route: 'US 23', small: 'https://itscameras.example/images/toledo/c4.jpg', large: 'https://itscameras.example/images/toledo/c4.jpg' }]),
  camera(5, 41.58, -83.62, [{ direction: 'View', route: 'I-475', small: 'https://itscameras.example/images/toledo/c5.jpg', large: 'https://itscameras.example/images/toledo/c5.jpg' }]),
] });
const alpr = (n, lat, lng, direction, extra = {}) => ({ id: 'osm:node/' + (1000 + n), lat, lng, direction, manufacturer: 'Flock Safety', operator: "Lucas County Sheriff's Office", zone: 'traffic', mount: 'post', kind: 'fixed', model: '', ...extra });
const readers = () => ({ format: 'orient-alpr', version: 1, updated: new Date().toISOString(), source: { id: 'osm-alpr', name: 'Plate readers mapped on OpenStreetMap', publisher: 'OpenStreetMap contributors (mapped with DeFlock)', homepage: 'https://deflock.org/', license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors', status: 'ok', fetched: new Date().toISOString(), dataAsOf: new Date(Date.now() - 3600e3).toISOString() }, items: [
  alpr(1, 41.6560, -83.5400, 45), alpr(2, 41.6563, -83.5405, 225), alpr(3, 41.640, -83.560, 345, { operator: 'Toledo Police Department' }), alpr(4, 41.670, -83.500, null, { operator: 'Toledo Police Department', manufacturer: 'Genetec' }),
  alpr(5, 41.600, -83.620, 90, { operator: 'Perrysburg Police Department' }), alpr(6, 41.780, -83.450, 180), alpr(7, 41.500, -83.700, 270, { operator: "Lowe's", manufacturer: 'Motorola Solutions' }),
] });
module.exports = { roadwork, incidents, cameras, alpr: readers, CIVIC_BASE: 'https://raw.githubusercontent.com/ragingapathy/toledo-commons/live-data/' };
