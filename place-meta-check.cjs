// Offline check: what the website reader says about a page (name, description, map location, business type).
const assert = require('node:assert/strict');
const W = require('./website.cjs');
const page = '<html><head><title>Home | Kava Culture | Toledo, OH</title><meta property="og:site_name" content="Kava Culture"><meta name="description" content="A kava bar and community space.">'
  + '<script type="application/ld+json">{"@type":"CafeOrCoffeeShop","name":"Kava Culture Toledo","telephone":"(419) 555-0100","address":{"streetAddress":"1 Example St","addressLocality":"Toledo","addressRegion":"OH","postalCode":"43604"},"geo":{"latitude":41.65,"longitude":-83.54}}</script></head><body></body></html>';
const m = W.extract(page, 'https://kava.example/').meta;
assert.deepEqual(m.names.map(n => n.value), ['Kava Culture Toledo', 'Kava Culture'], 'structured name first, then the site name; the cleaned title is not repeated');
assert.equal(m.description, 'A kava bar and community space.');
assert.deepEqual(m.coordinates, [-83.54, 41.65]); assert.deepEqual(m.types, ['CafeOrCoffeeShop']);
// titles with filler: "Home - Name", "Name | City", entities, generic-only titles
assert.equal(W.extract('<title>Home - Freedom Comics</title>', 'https://x.example/').meta.names[0].value, 'Freedom Comics');
assert.equal(W.extract('<title>Toledo Museum of Art &amp; Glass | Visit</title>', 'https://x.example/').meta.names[0].value, 'Toledo Museum of Art & Glass');
assert.deepEqual(W.extract('<title>Welcome</title>', 'https://x.example/').meta.names, []);
assert.equal(W.extract('<title>x</title>', 'https://x.example/').meta.coordinates, null);
// a structured name that is only the domain ranks after a real name
const dom=W.extract('<title>Kava Culture</title><script type="application/ld+json">{"@type":"WebSite","@type2":1}</script><script type="application/ld+json">{"@type":"Organization","name":"kavaculture.com"}</script>', 'https://kavaculture.com/').meta.names.map(n => n.value);
assert.deepEqual(dom, ['Kava Culture', 'kavaculture.com']);
// a published location outside the map's range, or at 0,0, is ignored
const bad = lat => W.extract('<script type="application/ld+json">{"@type":"Store","name":"S","geo":{"latitude":' + lat + ',"longitude":-83.5}}</script>', 'https://x.example/').meta.coordinates;
assert.equal(bad(95), null); assert.equal(W.extract('<script type="application/ld+json">{"@type":"Store","name":"S","geo":{"latitude":0,"longitude":0}}</script>', 'https://x.example/').meta.coordinates, null);
// non-business structured data does not set a type
assert.deepEqual(W.extract('<script type="application/ld+json">{"@type":"Article","name":"A"}</script>', 'https://x.example/').meta.types, []);
console.log('PASS: page name from structured data, site name, cleaned title; description; published map location with range checks; business types.');
