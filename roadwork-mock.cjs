// A made-up roadwork.json for the checks, in the shape commons-template/tools/fetch-roadwork.cjs publishes.
const day = 864e5;
const item = (id, status, roads, geometry, extra = {}) => ({ id: 'ohgo:' + id, source: 'ohgo', roads, direction: 'northbound', status, impact: status === 'closed' ? 'all-lanes-closed' : status === 'open' ? 'all-lanes-open' : 'some-lanes-closed', description: 'Bridge deck repair', from: 'Manhattan Blvd', to: 'Alexis Rd', start: new Date(Date.now() - 5 * day).toISOString(), end: new Date(Date.now() + 20 * day).toISOString(), upcoming: false, updated: new Date().toISOString(), geometry, ...extra });
const roadwork = (opts = {}) => ({
  format: 'orient-roadwork', version: 1, updated: new Date(Date.now() - (opts.ageMinutes ?? 5) * 60000).toISOString(), area: { name: 'Toledo region', bbox: [-84.3, 41.2, -82.7, 42.1] },
  sources: [{ id: 'ohgo', name: 'Ohio roads (OHGO)', publisher: 'Ohio Department of Transportation', homepage: 'https://www.ohgo.com/', license: 'CC0-1.0', status: 'ok', fetched: new Date().toISOString(), count: 6 }],
  items: [
    item('closed-1', 'closed', ['I-75'], [[-83.58, 41.62], [-83.56, 41.64], [-83.55, 41.66]], { description: 'All lanes closed for bridge demolition', from: 'Miami St', to: 'Front St' }),
    item('closed-2', 'closed', ['Anthony Wayne Trail'], [[-83.60, 41.64], [-83.59, 41.66]], { direction: 'southbound', description: 'Closed for utility work', from: 'Dorr St', to: 'Detroit Ave' }),
    item('restricted-1', 'restricted', ['US 23'], [[-83.62, 41.70], [-83.60, 41.72], [-83.58, 41.74]], { description: 'Right lane closed' }),
    item('soon-1', 'restricted', ['SR 25'], [[-83.52, 41.60], [-83.50, 41.62]], { upcoming: true, start: new Date(Date.now() + 3 * day).toISOString(), end: new Date(Date.now() + 10 * day).toISOString(), description: 'Resurfacing begins' }),
    item('open-1', 'open', ['I-475'], [[-83.70, 41.62], [-83.68, 41.64]], { description: 'Shoulder work, all lanes open' }),
    item('far-1', 'closed', ['I-75'], [[-83.65, 40.85], [-83.64, 40.86]], { description: 'Far away closure' }),
    // things the file should never be trusted to get right
    { id: 'junk-status', status: 'on-fire', geometry: [[-83.5, 41.6], [-83.4, 41.6]] }, { id: 'junk-geo', status: 'closed', geometry: [['a', 'b']] }, null, 'x',
    item('script', 'restricted', ['<img src=x onerror=alert(1)>'], [[-83.45, 41.7], [-83.44, 41.71]], { description: '<script>alert(1)</script> Right lane closed' }),
  ],
});
module.exports = { roadwork, ROADWORK_URL: 'https://raw.githubusercontent.com/ragingapathy/toledo-commons/live-data/roadwork.json' };
