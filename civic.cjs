 'use strict';
const fs=require('node:fs'),path=require('node:path'),{collect,point}=require('./commons-template/tools/civic.cjs');
const cache=new Map();let pending=null;
async function handle(req,res,json){
 if(req.method!=='GET')return json(res,405,{error:'Use GET.'});
 const u=new URL(req.url,'http://localhost'),center=[Number(u.searchParams.get('lng')),Number(u.searchParams.get('lat'))];
 if(!u.searchParams.has('lng')||!u.searchParams.has('lat')||!point(center))return json(res,400,{error:'Choose a valid area.'});
 const rounded=center.map(n=>Math.round(n*10)/10),key=rounded.join(',');
 const found=cache.get(key);if(found&&Date.now()-found.time<20*60e3)return json(res,200,found.data);
 if(pending)return json(res,429,{error:'Civic sources are refreshing. Try again shortly.'});
 pending=true;
 try{const snapshotFile=path.join(process.env.ORIENT_DATA_DIR||path.join(__dirname,'data'),'civic.json');
 let published;try{published=JSON.parse(fs.readFileSync(snapshotFile,'utf8'));}catch{}
 if(published?.format==='orient-civic'&&published.version===1&&point(published.center)&&require('./commons-template/tools/civic.cjs').distance(published.center,rounded)<60&&Date.now()-Date.parse(published.updated)<60*60e3)return json(res,200,published);
 const areas=rounded[0]>-85&&rounded[0]<-80&&rounded[1]>38&&rounded[1]<42?[{id:'SOH',name:'Ohio statewide'}]:rounded[0]>-104&&rounded[0]<-80&&rounded[1]>36&&rounded[1]<49?[{id:'R20',name:'Midwest region'}]:[];
 const data=await collect({sourceId:'orient-public-sources',center:rounded,airnow:true,toledoAmenities:true,eiaAreas:areas});cache.set(key,{time:Date.now(),data});if(cache.size>50)cache.delete(cache.keys().next().value);json(res,200,data);
 }catch{json(res,422,{error:'Civic sources could not be reached.'});}finally{pending=null;}
}
module.exports={handle};
