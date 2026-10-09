const assert=require('node:assert/strict');const path=require('node:path');
const {chromium}=require((process.env.ORIENT_PLAYWRIGHT||'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('orient-field-map-v1',JSON.stringify({version:1,custom:[{id:'local-downtown',name:'My downtown starting point',kind:'Other',coordinates:[-83.539,41.655]}],saved:['local-downtown'],visited:[],showDemo:false,fog:true})));
 await page.route('**/api/places',r=>r.fulfill({status:502,json:{error:'Open map details unavailable.'}}));
 await page.goto('http://127.0.0.1:4173');await page.waitForTimeout(5000);
 await page.getByRole('button',{name:'Explore this place',exact:true}).click();await page.getByRole('button',{name:'Look around this place',exact:true}).click();
 await page.locator('.discovery-row').first().waitFor();
 const count=await page.locator('.discovery-row').count();assert.ok(count>0);console.log('PASS: live basemap yielded '+count+' nearby discoveries when full data endpoint was unavailable.');
 await page.locator('.discovery-row').first().click();await page.getByRole('button',{name:'Explore this place',exact:true}).click();
 await page.locator('.source-facts summary').click();
 assert.match(await page.locator('#sheet').innerText(),/Map label only/);assert.match(await page.locator('#sheet').innerText(),/Hours unknown/);
 await page.locator('#sheet .save').click();
 const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')));assert.equal(data.osm.length,1);assert.match(data.osm[0].id,/^tile-/);assert.equal(data.visited.length,0);
 await page.screenshot({path:path.join(__dirname,'output/playwright/live-map-discovery.png')});
 const fresh=await context.newPage();await fresh.goto('http://127.0.0.1:4173');await fresh.getByRole('button',{name:'My Map',exact:true}).click();await fresh.getByRole('button',{name:'Switch to list',exact:true}).click();assert.match(await fresh.locator('#panel').innerText(),new RegExp(data.osm[0].name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 assert.deepEqual(errors,[]);console.log('PASS: fallback card labels missing details honestly; saved map-label place survives a new page without being marked visited.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
