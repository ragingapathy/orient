const assert=require('node:assert/strict');
const {geocode}=require('./geocode.cjs');
(async()=>{
 const query='1 Government Center, Toledo, OH 43604';
 let calls=[];
 const response=await geocode(query,async url=>{
  calls.push(new URL(url));
  return {ok:true,json:async()=>({result:{addressMatches:[
   {matchedAddress:'1 GOVERNMENT CTR, TOLEDO, OH, 43604',addressComponents:{zip:'43604'},coordinates:{x:-83.62,y:41.72}},
   {matchedAddress:'3 GOVERNMENT CTR, TOLEDO, OH, 43604',addressComponents:{zip:'43604'},coordinates:{x:-83.62,y:41.72}},
   {matchedAddress:'1 GOVERNMENT CTR, TOLEDO, OH, 99999',addressComponents:{zip:'99999'},coordinates:{x:-83.62,y:41.72}},
   {matchedAddress:'GOVERNMENT CTR, TOLEDO, OH, 43604',addressComponents:{zip:'43604'},coordinates:{x:-83.62,y:41.72}}
  ]}})};
 });
 assert.equal(calls[0].hostname,'geocoding.geo.census.gov');assert.equal(calls[0].searchParams.get('address'),query);assert.equal(response.results.length,1);assert.match(response.results[0].accuracy,/Estimated/);
 calls=[];
 const empty=await geocode(query,async url=>{calls.push(url);return {ok:true,json:async()=>({result:{addressMatches:[]}})};});
 assert.equal(empty.results.length,0);assert.equal(calls.length,1);assert.match(empty.message,/Nearby roads and bus stops are not substitutes/);
 const photon=await geocode('Glass City Motors Toledo',async url=>{assert.equal(new URL(url).hostname,'photon.komoot.io');return {ok:true,json:async()=>({features:[{type:'Feature',geometry:{type:'Point',coordinates:[-83.62,41.72]},properties:{name:'West Example Road',osm_key:'highway',city:'Toledo'}}]})};});
 assert.match(photon.results[0].accuracy,/Not a street-number address/);
 console.log('PASS: numbered addresses route to Census; mismatched house numbers/ZIPs and street-only candidates rejected; no silent Photon fallback; estimated positions and road matches explicitly labeled.');
})().catch(e=>{console.error(e);process.exit(1);});
