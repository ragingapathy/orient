const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require((process.env.ORIENT_PLAYWRIGHT||'playwright'));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');
 const id=await page.locator('#sheet').getAttribute('data-place-id');
 await page.getByRole('radio',{name:'4 out of 5 stars',exact:true}).check();
 assert.match(await page.locator('.personal-rating legend').innerText(),/4\/5/);
 await page.getByRole('radio',{name:'4 out of 5 stars',exact:true}).press('ArrowLeft');
 assert.ok(await page.getByRole('radio',{name:'3 out of 5 stars',exact:true}).isChecked());
 let raw=await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')));assert.equal(raw.ratings[id],3);assert.ok(raw.saved.includes(id));assert.equal(raw.visited.length,0);
 await page.reload();assert.ok(await page.getByRole('radio',{name:'3 out of 5 stars',exact:true}).isChecked());
 await page.getByRole('button',{name:'My Map',exact:true}).click();await page.getByRole('button',{name:'Switch to list',exact:true}).click();assert.match(await page.locator('#panel [data-place="'+id+'"]').innerText(),/★ 3\/5/);
 await page.getByRole('button',{name:'Open settings',exact:true}).click();const dp=page.waitForEvent('download');await page.getByRole('button',{name:'Export my map',exact:true}).click();const exported=JSON.parse(fs.readFileSync(await(await dp).path(),'utf8'));assert.equal(exported.ratings[id],3);
 page.once('dialog',d=>d.accept());await page.locator('#import-file').setInputFiles({name:'orient.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.locator('#panel [data-place="'+id+'"]').click();assert.ok(await page.getByRole('radio',{name:'3 out of 5 stars',exact:true}).isChecked());
 await page.setViewportSize({width:320,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(__dirname,'output/playwright/personal-rating.png')});
 await page.getByRole('button',{name:'Clear your rating',exact:true}).click();assert.equal(await page.locator('[name=place-rating]:checked').count(),0);raw=await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')));assert.equal(raw.ratings[id],undefined);
 exported.ratings[id]=6;await page.getByRole('button',{name:'Open settings',exact:true}).click();page.once('dialog',d=>d.accept());await page.locator('#import-file').setInputFiles({name:'orient.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});raw=await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')));assert.equal(raw.ratings[id],undefined,'Invalid ratings discarded');
 assert.deepEqual(errors,[]);console.log('PASS: personal rating, keyboard adjustment, no automatic visit, reload/list/export/import, clear, invalid import, 320px layout.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
