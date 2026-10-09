const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.ORIENT_PLAYWRIGHT||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/state**',r=>r.fulfill({status:403,contentType:'application/json',body:'{"error":"Isolated test"}'}));
  await page.goto(process.env.ORIENT_URL||'http://127.0.0.1:4173');await page.waitForFunction(()=>window.OrientPhotos);
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1800;c.height=1200;const ctx=c.getContext('2d');ctx.fillStyle='#205b4a';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#cadbc5';ctx.fillRect(300,400,1200,300);return c.toDataURL('image/png').split(',')[1];});
  await page.evaluate(()=>localStorage.setItem('orient-field-map-v1',JSON.stringify({version:1,custom:[{id:'local-photo',name:'Photo bench',kind:'Public space',coordinates:[-83.539,41.655]}],saved:['local-photo'],visited:[],showDemo:false})));
  async function openPlace(){await page.locator('#search').fill('Photo bench');await page.locator('.row[data-place="local-photo"]').click();const fold=page.locator('details.place-photos');if(!await fold.count()){await page.locator('.grip').press('End');}if(!await fold.evaluate(el=>el.open))await fold.locator('summary').click();return fold;}
  await page.reload();let fold=await openPlace();await fold.locator('[data-photo-add]').click();
  await page.locator('[data-photo-file]').first().setInputFiles({name:'bench.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.getByText('Ready to save.',{exact:true}).waitFor();
  await page.locator('[name=photo-note]').fill('Shade after lunch <script>not markup</script>');await page.getByRole('button',{name:'Save photo',exact:true}).click();
  assert.equal(await page.locator('.place-photo').count(),1);assert.match(await page.locator('.place-photo').innerText(),/Shade after lunch/);assert.equal(await page.locator('.place-photos script').count(),0);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')).photos['local-photo'][0]);assert.match(stored.image,/^data:image\/jpeg;base64,/);assert.ok(stored.image.length<=150000);
  await page.evaluate(()=>document.querySelector('[name="place-rating"][value="4"]').click());await page.locator('[data-action="clear-rating"]').click();assert.equal(await page.locator('.place-photo').count(),1);
  await page.locator('.place-photo').click();await page.locator('[name=photo-note]').fill('Quiet riverside bench');await page.getByRole('button',{name:'Save note',exact:true}).click();await page.screenshot({path:'output/playwright/photos-mobile.png'});
  await page.reload();fold=await openPlace();assert.match(await fold.innerText(),/Quiet riverside bench/);
  await page.locator('.place-photo').click();assert.equal(await page.locator('[name=photo-note]').inputValue(),'Quiet riverside bench');await page.screenshot({path:'output/playwright/photo-note-mobile.png'});
  await page.locator('[data-photo-close]').click();const [download]=await Promise.all([page.waitForEvent('download'),page.evaluate(()=>document.querySelector('[data-action="export"]').click())]);const fs=require('node:fs/promises');const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.equal(exported.photos['local-photo'][0].note,'Quiet riverside bench');
  const clean=await page.evaluate(raw=>{const ids=new Set(['local-photo']);const out=OrientPhotos.clean(raw.photos,ids);const bad=OrientPhotos.clean({'local-photo':[{id:'bad',image:'data:image/svg+xml;base64,AAAA',note:'bad'}]},ids);return {count:out['local-photo'].length,bad:Object.keys(bad).length};},exported);assert.deepEqual(clean,{count:1,bad:0});
  await page.locator('.place-photo').click();await page.getByRole('button',{name:'Remove photo',exact:true}).click();assert.equal(await page.locator('.place-photo').count(),0);await page.reload();await openPlace();assert.equal(await page.locator('.place-photo').count(),0);
  page.once('dialog',d=>d.accept());await page.locator('#import-file').setInputFiles({name:'orient-photo-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.waitForFunction(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')).photos?.['local-photo']?.length===1);
  const {merge}=require('./public/sync.js'),a={id:'photo-a',image:stored.image,note:'first'},b={id:'photo-b',image:stored.image,note:'second'};
  assert.equal(merge({photos:{}},{photos:{'local-photo':[a]}},{photos:{'local-photo':[b]}},false).photos['local-photo'].length,2);
  assert.deepEqual(merge({photos:{'local-photo':[a]}},{photos:{'local-photo':[]}},{photos:{'local-photo':[a,b]}},false).photos['local-photo'].map(p=>p.id),['photo-b']);
  assert.deepEqual(errors,[]);console.log('Photos: resizing, safe notes, editing, reload, rating independence, removal, backup/import, sync merges and mobile gallery passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
