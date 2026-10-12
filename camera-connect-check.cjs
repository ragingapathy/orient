'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {create}=require('./civic-connect.cjs');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orient-camera-check-'));let detailCalls=0;
 const service=create({dir,fetchImpl:async(url)=>{const u=new URL(url);
  if(u.pathname.endsWith('AllForMap'))return Response.json([{id:1129,latitude:42.49,longitude:-83.04,title:'Michigan fixture'},{id:2,latitude:0,longitude:0,title:'Outside area'}]);
  if(u.pathname.includes('getCameraInformation')){detailCalls++;return Response.json({link:'https://micamerasimages.net/thumbs/fixture.jpg',orientation:'North',title:'Michigan fixture'});}
  if(u.pathname.endsWith('interpreter')){assert(u.searchParams.has('data'));return Response.json({elements:[{type:'node',id:1,lat:42.49,lon:-83.04,tags:{manufacturer:'Flock Safety','camera:direction':'NE'}}]});}
  if(u.pathname.endsWith('/cameras')){if(u.searchParams.get('key')!=='fixture-key')return new Response('{}',{status:401});return Response.json([{Id:1,Latitude:43.05,Longitude:-89.4,Location:'Wisconsin fixture',Views:[{Url:'https://511wi.gov/map/Cctv/1',Status:'Enabled'}]},{Id:2,Latitude:0,Longitude:0,Views:[{Url:'https://511wi.gov/map/Cctv/2'}]},{Id:3,Latitude:43.05,Longitude:-89.4,Views:[{Url:'javascript:alert(1)'}]}]);}
  throw Error('Unexpected fixture request');
 }});
 const request=async(url,origin)=>{let result;await service.handle({url,method:'GET',headers:{host:'localhost',...(origin?{origin}:{})},socket:{remoteAddress:'test'}},{headersSent:false},new URL(url,'http://localhost').pathname,(_,status,body)=>result={status,body});return result;};
 try{
  let r=await request('/api/civic-connect/cameras?lng=-83.05&lat=42.49');assert.equal(r.status,200);assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].detail,true);
  assert.equal((await request('/api/civic-connect/camera?id=mi:1129')).body.views.length,1);await request('/api/civic-connect/camera?id=mi:1129');assert.equal(detailCalls,1);
  assert.notEqual((await request('/api/civic-connect/camera?id=https://localhost/private')).status,200);
  assert.equal((await request('/api/civic-connect/cameras?lng=NaN&lat=42')).status,400);assert.equal((await request('/api/civic-connect/cameras?lng=-83&lat=42','https://other.example')).status,403);
  r=await request('/api/civic-connect/alpr?lng=-83.05&lat=42.49');assert.equal(r.body.items[0].manufacturer,'Flock Safety');assert.equal(r.body.items[0].direction,45);
  // Overpass is slow and flaky: a slow or broken first try is retried, and what it said survives a restart.
  {const keep=setInterval(()=>{},500);const d2=fs.mkdtempSync(path.join(os.tmpdir(),'orient-alpr-check-'));try{
   const calls=[];const node=n=>({type:'node',id:n,lat:41.65,lon:-83.54,tags:{manufacturer:'Flock Safety','camera:direction':'90'}});
   const flaky=create({dir:d2,alprTimeout:300,fetchImpl:async(url,opts)=>{calls.push(new URL(url).hostname);
    if(calls.length===1)return new Response('<?xml version="1.0"?><remark>runtime error: Query timed out</remark>',{status:200});
    if(calls.length===2)return new Promise((_,no)=>opts.signal.addEventListener('abort',()=>no(Error('timed out'))));   // never answers
    return Response.json({elements:[node(7),node(8)]});}});
   const ask=(svc,u='/api/civic-connect/alpr?lng=-83.54&lat=41.66')=>{let out;return svc.handle({url:u,method:'GET',headers:{host:'localhost'},socket:{remoteAddress:'t'}},{headersSent:false},'/api/civic-connect/alpr',(_,status,body)=>out={status,body}).then(()=>out);};
   let a=await ask(flaky);assert.equal(a.status,200,'the third try answers');assert.equal(a.body.items.length,2);assert.deepEqual(calls,['overpass-api.de','overpass.openstreetmap.fr','overpass-api.de']);
   assert.ok(fs.existsSync(path.join(d2,'alpr-cache.json')),'saved to disk');
   const down=create({dir:d2,alprTimeout:300,fetchImpl:async()=>{throw Error('down');}});
   a=await ask(down);assert.equal(a.status,200,'a restart still has the saved copy');assert.equal(a.body.items.length,2);
   const cold=create({dir:fs.mkdtempSync(path.join(os.tmpdir(),'orient-alpr-cold-')),alprTimeout:300,fetchImpl:async()=>{throw Error('down');}});
   a=await ask(cold,'/api/civic-connect/alpr?lng=-80&lat=40');assert.equal(a.status,503,'nothing saved and nothing answering is an honest 503');
  }finally{clearInterval(keep);fs.rmSync(d2,{recursive:true,force:true});}}
  const input={providerId:'camera-wisconsin',state:'Wisconsin',center:[-89.4,43.05],key:'bad'};await assert.rejects(service.connect(input));const linked=await service.connect({...input,key:'fixture-key'});assert.equal(linked.statuses.cameras.count,1);assert.equal(linked.statuses.roadwork,undefined);assert(!JSON.stringify(linked).includes('fixture-key'));assert.equal(service.unseal(linked.token).key,'fixture-key');
  console.log('PASS independent Michigan camera lookup, bounded detail IDs and cache, coordinates/origin validation, national ALPR GET with retry and a saved copy, key rejection, geographic filtering, safe image URLs, and encrypted camera-only connection.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
