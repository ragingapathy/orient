if(!require('node:fs').existsSync(require('node:path').join(__dirname,'public/catalog.local.js'))){console.log('SKIP: needs public/catalog.local.js (a local catalog of places)');process.exit(0);}
const H=require('./check-helpers.cjs');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const F=async p=>{await p.evaluate(()=>document.querySelectorAll('#sheet details.fold').forEach(d=>{d.open=true;}));return p;};
const {chromium}=require((process.env.ORIENT_PLAYWRIGHT||'playwright'));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 const stamp=new Date().toISOString(),date=stamp.slice(0,10),url='https://comic.example/';let revised=false,fail=false;
 const event={uid:'web-event',title:'Website comic release',date,time:'18:00',end:'20:00',note:'Published by venue',location:'The comic shop',sourceURL:url};
 await page.route('**/api/website',async route=>{const input=route.request().postDataJSON();requests.push(input);if(fail){await route.fulfill({status:502,json:{error:'Website unavailable'}});return;}const feed=input.url.endsWith('.ics');await route.fulfill({json:{url:input.url,retrievedAt:stamp,readPages:[input.url],warnings:[],isFeed:feed,facts:feed?[]:[{key:'hours',value:'Wednesday 10–7',sourceURL:url,method:'Structured website data'},{key:'phone',value:'419-555-0100',sourceURL:url,method:'Published phone link'}],events:[{...event,title:revised?'Updated release night':event.title,sourceURL:input.url}],calendars:feed?[]:[{url:url+'calendar.ics',label:'Published calendar'}]}});});
 await H.seed(page,{useCatalog:true});await page.goto((process.env.ORIENT_URL||'http://127.0.0.1:4173'));await H.openDefault(page);await page.evaluate(()=>document.querySelector('#sheet button.expand').click());
 await (await F(page)).getByRole('button',{name:'Edit hours, people & notes'}).click();await page.locator('#knowledge-dialog [name=note]').fill('My own note');await page.locator('#knowledge-dialog [name=hours]').fill('Hours I observed');await page.getByRole('button',{name:'Save place details'}).click();
 await (await F(page)).getByRole('button',{name:'Read a website',exact:true}).click();await page.locator('#website-form input').fill(url);await page.getByRole('button',{name:'Look for details & calendars'}).click();await page.locator('[data-fact="0"]').check();await page.locator('[data-fact="1"]').check();await page.locator('[data-event="0"]').check();await page.screenshot({path:path.join(__dirname,'output/playwright/website-review.png')});
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')).web?.sources.length||0),0,'Preview must not save data');
 await page.getByRole('button',{name:'Save selected information'}).click();assert.match(await page.locator('#sheet').innerText(),/Hours I observed/);assert.match(await page.locator('.place-glance').innerText(),/Hours I observed/);assert.match(await page.locator('.place-glance').innerText(),/419-555-0100/);
 await page.getByRole('button',{name:'Calendar',exact:true}).click();assert.match(await page.locator('#panel').innerText(),/Website comic release/);assert.match(await page.locator('#panel').innerText(),/Website source/);
 await page.locator('#panel [data-cal=place]').filter({hasText:'Website comic release'}).click();await (await F(page)).getByRole('button',{name:'Read a website',exact:true}).click();await page.locator('#website-form input').fill(url);await page.getByRole('button',{name:'Look for details & calendars'}).click();await page.getByRole('button',{name:'Preview calendar',exact:true}).click();await page.locator('#website-follow').check();await page.getByRole('button',{name:'Save selected information'}).click();
 revised=true;await page.getByRole('button',{name:'Refresh calendar',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Calendar refreshed'));
 assert.match(await page.locator('#sheet').innerText(),/My own note/);
 fail=true;await page.getByRole('button',{name:'Refresh calendar',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('last imported entries were kept'));
 await page.getByRole('button',{name:'Calendar',exact:true}).click();assert.match(await page.locator('#panel').innerText(),/Updated release night/);
 await page.screenshot({path:path.join(__dirname,'output/playwright/website-calendar.png')});
 await page.reload();await page.getByRole('button',{name:'Calendar',exact:true}).click();assert.match(await page.locator('#panel').innerText(),/Updated release night/);
 await page.getByRole('button',{name:'Open settings',exact:true}).click();const dp=page.waitForEvent('download');await page.getByRole('button',{name:'Export my map',exact:true}).click();const exported=JSON.parse(fs.readFileSync(await(await dp).path(),'utf8'));assert.equal(exported.web.sources.length,2);assert.equal(Object.values(exported.web.profiles)[0].length,2);
 page.once('dialog',d=>d.accept());await page.locator('#import-file').setInputFiles({name:'orient.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.getByRole('button',{name:'Calendar',exact:true}).click();assert.match(await page.locator('#panel').innerText(),/Updated release night/);
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.locator('#panel [data-cal=place]').filter({hasText:'Updated release night'}).first().click();
 assert.equal(await page.getByRole('link',{name:'Open website',exact:true}).getAttribute('href'),url,'Feed preview must not replace website');
 await (await F(page)).getByRole('button',{name:'Read a website',exact:true}).click();
 await page.locator('#website-form input').fill('blocked.example');
 await page.getByRole('button',{name:'Look for details & calendars'}).click();
 await page.waitForFunction(()=>document.querySelector('#website-status').textContent.includes('Website unavailable'));
 assert.match(await page.locator('#website-status').innerText(),/Website address saved/);
 await page.locator('#website-dialog [data-web=close]').click();
 assert.equal(await page.getByRole('link',{name:'Open website',exact:true}).getAttribute('href'),'https://blocked.example/');
 await page.reload();await H.openDefault(page);await H.expand(page);
 assert.equal(await page.getByRole('link',{name:'Open website',exact:true}).getAttribute('href'),'https://blocked.example/');
 await (await F(page)).getByRole('button',{name:'Read a website',exact:true}).click();
 await page.locator('#website-form input').fill('https://saved-without-reading.example/');const requestsBefore=requests.length;
 await page.getByRole('button',{name:'Save website',exact:true}).click();
 assert.equal(requests.length,requestsBefore,'Saving website must not request it');
 assert.equal(await page.getByRole('link',{name:'Open website',exact:true}).getAttribute('target'),'_blank');
 await (await F(page)).getByRole('button',{name:'Read a website',exact:true}).click();await page.locator('#website-form input').fill('javascript:alert(1)');await page.getByRole('button',{name:'Save website',exact:true}).click();assert.match(await page.locator('#website-status').innerText(),/valid HTTP or HTTPS/);await page.locator('#website-dialog [data-web=close]').click();
 await page.unroute('**/api/website');await page.route('**/api/website',r=>r.fulfill({json:{url:'https://empty.example/',retrievedAt:stamp,readPages:['https://empty.example/'],facts:[],events:[],calendars:[],warnings:[],isFeed:false}}));
 await (await F(page)).getByRole('button',{name:'Read a website',exact:true}).click();await page.locator('#website-form input').fill('https://empty.example/');await page.getByRole('button',{name:'Look for details & calendars'}).click();await page.getByText('No readable profile details found.',{exact:true}).waitFor();await page.locator('#website-dialog [data-web=close]').click();
 assert.equal(await page.getByRole('link',{name:'Open website',exact:true}).getAttribute('href'),'https://empty.example/');
 await H.collapse(page);
 assert.ok(await page.locator('#sheet .glance-hours').isVisible());
 assert.match(await page.locator('#sheet .glance-hours').innerText(),/Hours I observed/);
 assert.ok(await page.getByRole('link',{name:'Open website',exact:true}).isVisible());
 assert.equal(await page.locator('#sheet .place-knowledge').count(),0,'Collapsed card does not show people/notes section');
 await page.setViewportSize({width:320,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(__dirname,'output/playwright/place-glance.png')});
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')));const cleaned=await page.evaluate(raw=>OrientWebsite.clean(raw.web,new Set(Object.keys(raw.web.urls))),stored);assert.ok(Object.values(cleaned.urls).includes('https://empty.example/'));
 assert.ok(requests.every(x=>Object.keys(x).sort().join()==='timeZone,url'&&typeof x.url==='string'),'Only the URL and the time zone are sent');assert.deepEqual(errors,[]);
 console.log('PASS: website saved on blocked/empty reads; independent save without requests; safe browser link; URL persistence/import cleaning; preview preserves website; review/import/follow/refresh/export/import/mobile/privacy.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
