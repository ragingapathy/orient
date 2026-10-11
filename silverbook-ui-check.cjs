const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.ORIENT_PLAYWRIGHT||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/state**',r=>r.fulfill({status:403,contentType:'application/json',body:'{"error":"Isolated test"}'}));
 const sbPeople=[{id:'maya',name:'Maya Chen'},{id:'oliver',name:'Oliver Brooks'}];
 await page.route('**/api/silverbook',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({connected:true,people:sbPeople})}));
 await page.addInitScript(()=>{if(sessionStorage.getItem('fixture'))return;sessionStorage.setItem('fixture','1');localStorage.setItem('orient-field-map-v1',JSON.stringify({version:1,home:{name:'Toledo',coordinates:[-83.539,41.655],timeZone:'America/New_York'},useCatalog:false,custom:[{id:'local-cafe',name:'Lantern Café',coordinates:[-83.539,41.655],kind:'Food & drink'}],saved:['local-cafe'],fog:true}));});
 await page.goto(process.env.ORIENT_URL||'http://127.0.0.1:4176');await page.waitForFunction(()=>window.OrientSilverbook&&document.querySelector('.map-marker'));
 await page.locator('.map-marker[aria-label^="Lantern"]').click();await page.locator('.grip').press('End');await page.locator('details.place-knowledge summary').click();await page.getByRole('button',{name:'Edit hours, people & notes',exact:true}).click();

 await page.locator('[data-silverbook-card]').waitFor();
 assert.match(await page.locator('[data-silverbook-card]').innerText(),/Nobody linked yet/);
 await page.locator('[data-silverbook-select]').selectOption('maya');await page.locator('[data-silverbook-link]').click();
 assert.equal(await page.locator('[data-silverbook-unlink]').count(),1);
 assert.match(await page.locator('[data-silverbook-card]').innerText(),/Maya Chen/);
 const afterMaya=(await page.locator('[data-silverbook-select] option').allInnerTexts()).filter(t=>t!=='Choose a person');
 assert.deepEqual(afterMaya,['Oliver Brooks'],'a linked person is no longer offered a second time');
 await page.locator('[data-silverbook-select]').selectOption('oliver');await page.locator('[data-silverbook-link]').click();
 assert.equal(await page.locator('[data-silverbook-unlink]').count(),2);
 assert.equal(await page.locator('[data-silverbook-select]').count(),0,'nobody left to add once everyone is linked');
 await page.locator('[data-silverbook-unlink]').first().click();
 assert.equal(await page.locator('[data-silverbook-unlink]').count(),1);
 assert.match(await page.locator('[data-silverbook-card]').innerText(),/Oliver Brooks/);
 await page.getByRole('button',{name:'Save place details',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')).details['local-cafe'].silverbookIds),['oliver']);

 // Reload: the link survives (it goes through the same clean() as sync), and the card shows who you went with.
 await page.reload();await page.waitForFunction(()=>window.OrientSilverbook&&document.querySelector('.map-marker'));
 await page.locator('.map-marker[aria-label^="Lantern"]').click();await page.locator('.grip').press('End');await page.locator('details.place-knowledge summary').click();
 await page.waitForFunction(()=>document.querySelector('.place-knowledge')?.textContent.includes('Oliver Brooks'));
 assert.match(await page.locator('.place-knowledge').innerText(),/With[\s\S]*Oliver Brooks/);

 // When Silverbook is closed, the dialog says so plainly and the already-linked id is kept, not discarded.
 await page.unroute('**/api/silverbook');
 await page.route('**/api/silverbook',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({connected:false,people:[],message:'Open Silverbook on this computer to link people.'})}));
 await page.evaluate(()=>OrientSilverbook.load(true));
 await page.getByRole('button',{name:'Edit hours, people & notes',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-silverbook-card]')?.textContent.includes('Open Silverbook'));
 assert.equal(await page.locator('[data-silverbook-select]').count(),0);
 assert.equal(await page.locator('[data-silverbook-unlink]').count(),0);
 await page.getByRole('button',{name:'Save place details',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')).details['local-cafe'].silverbookIds),['oliver'],'saving while Silverbook is closed does not erase the existing link');
 assert.deepEqual(errors,[]);
 console.log('Silverbook UI: linking and unlinking a person from the place dialog, no repeated offers, the card showing who you went with, persistence across reload, and a graceful message that keeps the link when Silverbook is closed, all passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
