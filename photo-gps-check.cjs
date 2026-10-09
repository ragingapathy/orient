const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.ORIENT_PLAYWRIGHT||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
function geotag(jpeg){
  const t=Buffer.alloc(128);t.write('II');t.writeUInt16LE(42,2);t.writeUInt32LE(8,4);t.writeUInt16LE(1,8);
  t.writeUInt16LE(0x8825,10);t.writeUInt16LE(4,12);t.writeUInt32LE(1,14);t.writeUInt32LE(26,18);t.writeUInt16LE(4,26);
  const entry=(pos,tag,type,count,value)=>{t.writeUInt16LE(tag,pos);t.writeUInt16LE(type,pos+2);t.writeUInt32LE(count,pos+4);t.writeUInt32LE(value,pos+8);};
  entry(28,1,2,2,78);entry(40,2,5,3,80);entry(52,3,2,2,87);entry(64,4,5,3,104);
  [[41,1],[39,1],[18,1],[83,1],[32,1],[204,10]].forEach(([n,d],i)=>{t.writeUInt32LE(n,80+i*8);t.writeUInt32LE(d,84+i*8);});
  const exif=Buffer.concat([Buffer.from('Exif\0\0'),t]),header=Buffer.alloc(4);header.writeUInt16BE(0xffe1);header.writeUInt16BE(exif.length+2,2);
  return Buffer.concat([jpeg.subarray(0,2),header,exif,jpeg.subarray(2)]);
}
module.exports={geotag};
if(require.main===module)(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/state**',r=>r.fulfill({status:403,contentType:'application/json',body:'{"error":"test"}'}));
  await page.goto(process.env.ORIENT_URL||'http://127.0.0.1:4173');await page.waitForFunction(()=>window.OrientPhotos);
  const plain=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=200;c.height=150;const ctx=c.getContext('2d');ctx.fillStyle='#205b4a';ctx.fillRect(0,0,200,150);return c.toDataURL('image/jpeg').split(',')[1];}),'base64'),tagged=geotag(plain);
  const coords=await page.evaluate(async bytes=>OrientPhotos.gps(new File([new Uint8Array(bytes)],'gps.jpg',{type:'image/jpeg'})),[...tagged]);assert.ok(Math.abs(coords[0]+83.539)<.000001);assert.ok(Math.abs(coords[1]-41.655)<.000001);
  await page.evaluate(()=>localStorage.setItem('orient-field-map-v1',JSON.stringify({version:1,custom:[{id:'local-current',name:'Original place',kind:'Public space',coordinates:[-83.6,41.7]},{id:'local-near',name:'Photo location bench',kind:'Public space',coordinates:[-83.539,41.655]}],saved:['local-current','local-near'],visited:[],showDemo:false})));
  await page.reload();await page.locator('#search').fill('Original place');await page.locator('.row[data-place="local-current"]').click();await page.locator('.grip').press('End');await page.locator('details.place-photos summary').click();await page.locator('[data-photo-add="local-current"]').click();
  const upload=async buffer=>{await page.locator('[data-photo-file]').first().setInputFiles({name:'location.jpg',mimeType:'image/jpeg',buffer});await page.getByText('Ready to save.',{exact:true}).waitFor();};
  await upload(tagged);assert.equal(await page.locator('[name=photo-destination]').inputValue(),'local-near');assert.match(await page.locator('[data-photo-destination]').innerText(),/GPS is approximate/);
  await page.locator('[name=photo-note]').fill('Matched to the bench, not the original card');await page.screenshot({path:'output/playwright/photo-gps-mobile.png'});await page.getByRole('button',{name:'Save photo',exact:true}).click();
  let data=await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')));assert.equal(data.photos['local-near'].length,1);assert.equal(data.photos['local-current'],undefined);
  const exifr=require('./public/vendor/exifr-7.1.3.js');assert.equal(await exifr.gps(Buffer.from(data.photos['local-near'][0].image.split(',')[1],'base64')),undefined);
  // A photo can start the workflow from My Map, without choosing a card first.
  await page.getByRole('button',{name:'My Map',exact:true}).click();await page.locator('[data-action="list"]').click();await page.locator('[data-photo-add=""]').click();await upload(tagged);await page.locator('[name=photo-destination]').selectOption('__new');await page.locator('[name=photo-place-name]').fill('Little mural at the photo');await page.getByRole('button',{name:'Save photo',exact:true}).click();
  data=await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')));const created=data.custom.find(p=>p.name==='Little mural at the photo');assert.ok(created);assert.deepEqual(created.coordinates,coords);assert.equal(data.photos[created.id].length,1);
  await page.getByRole('button',{name:'My Map',exact:true}).click();await page.locator('[data-action="list"]').click();await page.locator('[data-photo-add=""]').click();await upload(plain);assert.match(await page.locator('[data-photo-destination]').innerText(),/No readable GPS/);assert.equal(await page.locator('[name=photo-destination]').inputValue(),'');await page.locator('[name=photo-destination]').selectOption('local-current');await page.getByRole('button',{name:'Save photo',exact:true}).click();
  data=await page.evaluate(()=>JSON.parse(localStorage.getItem('orient-field-map-v1')));assert.equal(data.photos['local-current'].length,1);
  await page.getByRole('button',{name:'My Map',exact:true}).click();await page.locator('[data-action="list"]').click();await page.locator('[data-photo-add=""]').click();await upload(tagged);assert.equal(await page.locator('[name=photo-destination]').inputValue(),''); // two places at the same location: no guessed match
  await page.setViewportSize({width:320,height:740});assert.equal(await page.locator('#photo-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  assert.deepEqual(errors,[]);console.log('Photo GPS: real EXIF coordinates, nearby matching, ambiguous choice, destination override, new places, metadata removal, no-GPS fallback and mobile passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
