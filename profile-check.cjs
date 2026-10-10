const H=require('./check-helpers.cjs');
// Controlled Kava Culture-shaped fixture, not a claim about live venue details.
const assert=require('node:assert/strict'),path=require('node:path');
const F=async p=>{await p.evaluate(()=>document.querySelectorAll('#sheet details.fold').forEach(d=>{d.open=true;}));return p;};
const {chromium}=require((process.env.ORIENT_PLAYWRIGHT||'playwright'));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('orient-field-map-v1',JSON.stringify({version:1,custom:[],osm:[{id:'osm-node-9999',name:'Kava Culture',kind:'Café',icon:'coffee',coordinates:[-83.54,41.655],address:'Fixture street, Toledo',hours:'Mo-Su 10:00-22:00',phone:'419-555-0100',operator:'Fixture operator',wheelchair:'yes',website:'https://kava.example/',retrievedAt:'2026-10-08'}],saved:[],visited:[],drafts:{},showDemo:false,fog:true})));
await page.route('**/api/website',r=>{requests.push(r.request().postDataJSON());return r.fulfill({json:{url:'https://kava.example/',retrievedAt:new Date().toISOString(),readPages:['https://kava.example/'],isFeed:false,warnings:[],events:[],calendars:[],facts:[{key:'hours',value:'Daily 11–11',sourceURL:'https://kava.example/',method:'Structured website data'},{key:'phone',value:'419-555-0200',sourceURL:'https://kava.example/',method:'Published phone link'}]}});});
await page.goto((process.env.ORIENT_URL||'http://127.0.0.1:4173'));await H.list(page);await page.locator('#panel [data-place="osm-node-9999"]').click();
await page.evaluate(()=>document.querySelector('#sheet button.expand[aria-expanded=false]')?.click());assert.match(await page.locator('.place-glance').innerText(),/Fixture street/);assert.match(await page.locator('.place-glance').innerText(),/419-555-0100/);assert.equal(await page.getByRole('link',{name:'Open website',exact:true}).getAttribute('href'),'https://kava.example/');
await page.evaluate(()=>document.querySelector('#sheet button.expand[aria-expanded=false]')?.click());await (await F(page)).getByRole('button',{name:'Review website findings',exact:true}).waitFor();
assert.equal(requests.length,1);assert.deepEqual(requests[0],{url:'https://kava.example/',timeZone:'America/New_York'});assert.match(await page.locator('.profile-extra').innerText(),/Fixture operator/);assert.match(await page.locator('.profile-extra').innerText(),/yes/);
assert.equal(await page.getByText('What the map knows · Sources & details',{exact:true}).count(),0);assert.equal(await page.getByRole('link',{name:'Visit published website',exact:true}).count(),0);
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')).saved.length),0,'Automatic reading must not save or visit a place');
await (await F(page)).getByRole('button',{name:'Review website findings',exact:true}).click();await page.locator('[data-fact="0"]').check();await page.locator('[data-fact="1"]').check();await page.getByRole('button',{name:'Save selected information'}).click();
assert.match(await page.locator('.place-glance').innerText(),/Daily 11–11/);assert.match(await page.locator('.place-glance').innerText(),/419-555-0200/);assert.equal(await page.locator('.website-fact').count(),0);
await page.screenshot({path:path.join(__dirname,'output/playwright/unified-place-profile.png')});
await page.evaluate(()=>document.querySelector('#sheet [data-action=expand]').click());await page.evaluate(()=>document.querySelector('#sheet [data-action=expand]').click());assert.equal(requests.length,1,'Renders must not repeatedly scan websites');
assert.deepEqual(errors,[]);console.log('PASS: map facts visible in main profile, one website link, automatic map-website scan, review-only imports, consolidated imported facts, no auto marks, no repeated scans.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
