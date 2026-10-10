const H=require('./check-helpers.cjs');
const assert=require('node:assert/strict');
const F=async p=>{await p.evaluate(()=>document.querySelectorAll('#sheet details.fold').forEach(d=>{d.open=true;}));return p;};
const path=require('node:path');
const {normalize,safeURL}=require('./places.cjs');
const now=new Date().toISOString();
const fixture=normalize([
 {type:'node',id:101,lat:41.655,lon:-83.539,tags:{name:'Freedom Comics',shop:'comics',website:'https://example.org',opening_hours:'Mo-Sa 10:00-18:00'},timestamp:'2025-01-01T00:00:00Z'},
 {type:'node',id:102,lat:41.6555,lon:-83.5395,tags:{name:'Videogame Underground',shop:'video_games','contact:website':'javascript:alert(1)'}},
 {type:'way',id:103,center:{lat:41.65551,lon:-83.53951},tags:{name:'Videogame Underground',shop:'video_games'}},
 {type:'node',id:104,lat:41.6553,lon:-83.5392,tags:{name:'A café',amenity:'cafe'}},
 {type:'node',id:105,lat:41.6553,lon:-83.5392,tags:{name:'Closed shop',shop:'vacant'}}
],now);
assert.equal(fixture.length,3);assert.equal(safeURL('javascript:alert(1)'),'');assert.equal(fixture[1].website,'');assert.equal(fixture[1].hours,'');
const {chromium}=require((process.env.ORIENT_PLAYWRIGHT||'playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('orient-field-map-v1',JSON.stringify({version:1,custom:[{id:'local-freedom',name:'Freedom Comics',kind:'Comic shop',coordinates:[-83.539,41.655],address:'My saved shop',note:'Want to visit'}],saved:['local-freedom'],visited:[],showDemo:false,fog:true}));});
 await page.route(/tiles.openfreemap.org/,r=>r.abort()); // no live basemap places: only the fixture below
 await page.route('**/api/places',async route=>{const body=route.request().postDataJSON();assert.deepEqual(Object.keys(body).sort(),['lat','lng']);await route.fulfill({json:{places:fixture,retrievedAt:now,radius:800}});});
 await page.route('**/api/website',route=>route.fulfill({json:{url:'https://example.org/',retrievedAt:now,readPages:['https://example.org/'],facts:[],events:[],calendars:[],warnings:[]}}));
 await page.goto((process.env.ORIENT_URL||'http://127.0.0.1:4173'));await page.waitForFunction(()=>window.OrientHome&&document.querySelector('.bottom-nav'));
 await page.locator('.bottom-nav [data-tab="My Map"]').click();await H.list(page);await H.dom(page,'#panel [data-place="local-freedom"]');await H.expand(page);
 await (await F(page)).getByRole('button',{name:'Look around this place',exact:true}).click();
 await page.locator('.discovery-row').first().waitFor();
 assert.match(await page.locator('.discovery-row').first().innerText(),/Videogame Underground/);
 assert.match(await page.locator('.discovery-row').first().innerText(),/Related to this place/);
 assert.equal(await page.locator('.discovery-row').count(),2);
 await page.locator('.source-facts summary').click();
 assert.match(await page.locator('.source-facts').innerText(),/Human confirmation: unknown/);
 await page.getByRole('button',{name:'My Map',exact:true}).click();
 await page.evaluate(()=>document.querySelector('#sheet button.expand').click());
 await page.screenshot({path:path.join(__dirname,'output/playwright/nearby-discoveries.png')});
 await page.locator('.discovery-row').first().click();
 await page.evaluate(()=>document.querySelector('#sheet button.expand').click());
 assert.match(await page.locator('#sheet h2').innerText(),/Videogame Underground/);
 assert.match(await page.locator('#sheet').innerText(),/Hours unknown/);
 assert.match(await page.locator('#sheet').innerText(),/Not on your map/);
 assert.equal(await page.getByRole('link',{name:'Visit published website',exact:true}).count(),0);
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')));assert.equal(before.saved.length,1);assert.equal(before.visited.length,0);
 await page.locator('#sheet .save').click();
 const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')));assert.equal(data.saved.length,2);assert.equal(data.visited.length,0);assert.equal(data.osm.length,1);
 // Remove the seed script before reloading: verify actual persisted OSM snapshot.
 const page2=await page.context().newPage();await page2.goto((process.env.ORIENT_URL||'http://127.0.0.1:4173'));
 await page2.getByRole('button',{name:'My Map',exact:true}).click();
 await page2.getByRole('button',{name:'Switch to list',exact:true}).click();
 assert.match(await page2.locator('#panel').innerText(),/Videogame Underground/);
 await page2.locator('#panel [data-place="osm-node-102"]').click();
 await page2.evaluate(()=>document.querySelector('#sheet button.expand').click());
 await page2.locator('.source-facts summary').click();
 assert.equal(await page2.getByRole('link',{name:'OpenStreetMap source',exact:true}).getAttribute('href'),'https://www.openstreetmap.org/node/102');
 assert.deepEqual(errors,[]);
 console.log('PASS: OSM normalization/deduplication, safe links, related ranking, source freshness, unknown hours, suggestions never auto-saved/visited, saving and reload preserve OSM identity.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
