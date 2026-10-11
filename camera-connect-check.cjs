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
  const input={providerId:'camera-wisconsin',state:'Wisconsin',center:[-89.4,43.05],key:'bad'};await assert.rejects(service.connect(input));const linked=await service.connect({...input,key:'fixture-key'});assert.equal(linked.statuses.cameras.count,1);assert.equal(linked.statuses.roadwork,undefined);assert(!JSON.stringify(linked).includes('fixture-key'));assert.equal(service.unseal(linked.token).key,'fixture-key');
  console.log('PASS independent Michigan camera lookup, bounded detail IDs and cache, coordinates/origin validation, national ALPR GET, key rejection, geographic filtering, safe image URLs, and encrypted camera-only connection.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
