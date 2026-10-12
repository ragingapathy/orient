'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const wzdx=require('./commons-template/tools/wzdx.cjs'),ohgo=require('./commons-template/tools/ohgo.cjs');
const catalog=require('./civic-providers.json');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85;
function create({dir=process.env.ORIENT_DATA_DIR||path.join(__dirname,'data'),fetchImpl=fetch,providers=catalog.providers,alprTimeout=22000}={}){
 const cameraSources=require('./camera-sources.cjs').create({fetchImpl});
 let master;const cache=new Map(),pending=new Map(),limits=new Map();let connecting=0;
 // Plate readers come from OpenStreetMap's Overpass service, which is free, volunteer-run and sometimes slow: give it time, try the
 // main server twice and a French mirror, and keep what it said on disk so a restart does not forget it.
 const alprFile=path.join(dir,'alpr-cache.json'),alprCache=new Map();
 try{for(const [k,v] of JSON.parse(fs.readFileSync(alprFile,'utf8')))if(typeof k==='string'&&v&&Number.isFinite(v.at)&&v.body&&Array.isArray(v.body.items))alprCache.set(k,v);}catch{}
 function saveAlpr(){try{fs.mkdirSync(dir,{recursive:true});const tmp=alprFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify([...alprCache]));fs.renameSync(tmp,alprFile);}catch{}}
 async function fetchOverpass(query){
  for(const host of ['overpass-api.de','overpass.openstreetmap.fr','overpass-api.de','overpass.kumi.systems']){
   try{
    const response=await fetchImpl('https://'+host+'/api/interpreter?data='+encodeURIComponent(query),{headers:{'User-Agent':'Orient-Civic/1.0 (+https://orient.thealliedpeoplesunion.org/)','Accept':'application/json'},signal:AbortSignal.timeout(alprTimeout)});
    if(!response.ok)continue;
    let value;try{value=JSON.parse(await response.text());}catch{continue;}   // a busy server answers with an XML error page
    if(value&&Array.isArray(value.elements)&&!value.remark)return value;
   }catch{}
  }
  throw Error('Overpass did not answer');
 }

 function secret(){if(master)return master;fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'civic-connection-key.bin');try{master=fs.readFileSync(file);}catch(e){if(e.code!=='ENOENT')throw e;try{fs.writeFileSync(file,crypto.randomBytes(32),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}master=fs.readFileSync(file);}if(master.length!==32)throw fail(500,'Civic connection storage needs attention.');return master;}
 function seal(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',secret(),iv);const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');}
 function unseal(token){try{if(typeof token!=='string'||token.length>4096)throw Error();const b=Buffer.from(token,'base64url'),decipher=crypto.createDecipheriv('aes-256-gcm',secret(),b.subarray(0,12));decipher.setAuthTag(b.subarray(12,28));const value=JSON.parse(Buffer.concat([decipher.update(b.subarray(28)),decipher.final()]).toString());if(value.version!==1||!point(value.center)||Date.now()-value.at>180*86400000||!providers.some(p=>p.id===value.providerId))throw Error();return value;}catch{throw fail(401,'This civic connection has expired or is unavailable. Reconnect in Settings → Civic sources.');}}
 const id=token=>crypto.createHash('sha256').update(token).digest('hex').slice(0,24);
 const provider=pid=>providers.find(p=>p.id===pid);
 async function readJSON(url,headers={}){let response;for(let redirects=0;redirects<3;redirects++){response=await fetchImpl(url,{headers:{Accept:'application/json',...headers},redirect:'manual',signal:AbortSignal.timeout(20000)});if(response.status<300||response.status>=400)break;const next=new URL(response.headers.get('location')||'',url);if(next.protocol!=='https:'||next.origin!==new URL(url).origin)throw fail(422,'This provider has moved. Its connector needs an update.');url=next.href;}if(!response.ok)throw fail(response.status===401||response.status===403?401:422,response.status===401||response.status===403?'The provider did not accept this API key. Check the key and your account access.':'The provider is unavailable right now. Try again later.');let bytes=0;const chunks=[];if(response.body?.[Symbol.asyncIterator]){for await(const chunk of response.body){bytes+=chunk.length;if(bytes>20*1024*1024)throw fail(422,'The provider response is too large.');chunks.push(Buffer.from(chunk));}}else {const text=await response.text();if(Buffer.byteLength(text)>20*1024*1024)throw fail(422,'The provider response is too large.');chunks.push(Buffer.from(text));}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw fail(422,'The provider returned an unexpected response. Try again later.');}}
 async function dataset(value,name){const p=provider(value.providerId),now=new Date(),bbox=[Math.max(-180,value.center[0]-1),Math.max(-85,value.center[1]-.8),Math.min(180,value.center[0]+1),Math.min(85,value.center[1]+.8)];const source={id:p.id,name:p.name,publisher:p.name,homepage:p.signup||new URL(p.url).origin,license:'Source agency terms',status:'ok',fetched:now.toISOString()};
 if(name==='cameras'&&p.cameraApi){const u=new URL(p.cameraApi);u.searchParams.set('key',value.key);u.searchParams.set('format','json');const raw=await readJSON(u.href);return {format:'orient-cameras',version:1,updated:now.toISOString(),source,items:require('./camera-sources.cjs').normalize511(raw,bbox,p.id)};}
 if(name==='roadwork'){const u=new URL(p.url),headers={};if(p.auth?.query)u.searchParams.set(p.auth.query,value.key);if(p.auth?.header)headers[p.auth.header]=(p.auth.prefix||'')+value.key;const raw=await readJSON(u.href,headers);if(raw.type!=='FeatureCollection'||!Array.isArray(raw.features))throw fail(422,'This provider’s work-zone format is not supported yet.');return {format:'orient-roadwork',version:1,updated:now.toISOString(),area:{name:value.name,bbox},sources:[source],items:wzdx.normalize(raw,{source:p.id,bbox,now}).items};}
 if(!['cameras','incidents'].includes(name)||!p[name])throw fail(404,'This provider does not offer a supported '+name+' connection yet.');const u=new URL('https://publicapi.ohgo.com/api/v1/'+name);u.searchParams.set('page-all','true');u.searchParams.set('map-bounds-sw',bbox[1]+','+bbox[0]);u.searchParams.set('map-bounds-ne',bbox[3]+','+bbox[2]);const raw=await readJSON(u.href,{Authorization:'APIKEY '+value.key});const list=ohgo.get(raw,'results','items','data');if(!Array.isArray(list)&&!Array.isArray(raw))throw fail(422,'This provider returned an unexpected '+name+' format.');return {format:'orient-'+name,version:1,updated:now.toISOString(),source,items:(name==='cameras'?ohgo.normalizeCameras:ohgo.normalizeIncidents)(Array.isArray(raw)?raw:list,{bbox})};}
 async function cached(value,name,cacheId){const key=cacheId+':'+name,old=cache.get(key);if(old&&Date.now()-old.at<10*60e3)return old.body;if(pending.has(key))return pending.get(key);const promise=dataset(value,name).then(body=>{cache.set(key,{at:Date.now(),body});while(cache.size>100)cache.delete(cache.keys().next().value);return body;}).finally(()=>pending.delete(key));pending.set(key,promise);return promise;}
 async function connect(input,oldToken){const p=provider(input.providerId);if(!p||!p.states.includes(input.state)||!point(input.center))throw fail(400,'Choose a supported state, provider and city.');let key=typeof input.key==='string'?input.key.trim():'';if(!key&&oldToken){const old=unseal(oldToken);if(old.providerId===p.id)key=old.key||'';}if(key.length>512||/[\x00-\x20\x7f]/.test(key))throw fail(400,'Paste the API key without spaces or extra text.');if(p.needsKey&&!key)throw fail(400,'Paste your provider API key to connect.');const value={version:1,providerId:p.id,state:input.state,center:input.center.map(n=>Math.round(n*1000)/1000),name:String(input.name||input.state).slice(0,100),key:p.needsKey?key:'',at:Date.now()};const statuses={};const names=[...(p.roadwork===false?[]:['roadwork']),...(p.cameras?['cameras']:[]),...(p.incidents?['incidents']:[])];const results=await Promise.all(names.map(async name=>{try{return {name,body:await dataset(value,name)};}catch(error){return {name,error};}}));if(!results.some(r=>r.body))throw results[0].error;const token=seal(value),connectionId=id(token);for(const r of results){statuses[r.name]=r.body?{connected:true,count:r.body.items.length}:{connected:false,message:r.error.message};if(r.body)cache.set(connectionId+':'+r.name,{at:Date.now(),body:r.body});}while(cache.size>100)cache.delete(cache.keys().next().value);return {token,id:connectionId,providerId:p.id,state:input.state,name:value.name,center:value.center,statuses,connectedAt:new Date().toISOString()};}
 function allowed(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host;}catch{return false;}}
 function rate(req,budget=8,bucket='setup'){const address=bucket+':'+(req.headers['cf-connecting-ip']||req.socket.remoteAddress||'local');const now=Date.now(),times=(limits.get(address)||[]).filter(t=>now-t<60000);if(times.length>=budget)throw fail(429,'Please wait a minute before testing another connection.');times.push(now);limits.set(address,times);if(limits.size>2000)limits.delete(limits.keys().next().value);}
 async function handle(req,res,url,json){try{
 if(!allowed(req))throw fail(403,'Open Civic setup in Orient to connect.');
 if(url==='/api/civic-connect/cameras'||url==='/api/civic-connect/camera'){
 if(req.method!=='GET')throw fail(405,'Use GET.');rate(req,60,'cameras');const u=new URL(req.url,'http://localhost');
 if(url.endsWith('/camera'))return json(res,200,await cameraSources.detail(u.searchParams.get('id')||''));
 const center=[Number(u.searchParams.get('lng')),Number(u.searchParams.get('lat'))];if(!u.searchParams.has('lng')||!u.searchParams.has('lat')||!point(center))throw fail(400,'Choose a valid city.');
 return json(res,200,await cameraSources.list(center));
 }
 if(url==='/api/civic-connect/alpr'){
 if(req.method!=='GET')throw fail(405,'Use GET.');
 const u=new URL(req.url,'http://localhost'),center=[Number(u.searchParams.get('lng')),Number(u.searchParams.get('lat'))];
 if(!u.searchParams.has('lng')||!u.searchParams.has('lat')||!point(center))throw fail(400,'Choose a valid city.');
 const cell=center.map(n=>Math.round(n*10)/10),key='national-alpr:'+cell.join(','),old=alprCache.get(key);
 if(old&&Date.now()-old.at<12*3600e3)return json(res,200,old.body);
 rate(req,30,'alpr');
 // A copy that is old but not ancient is shown straight away while a fresh one is fetched, so a slow Overpass never blanks the map.
 const refresh=()=>{
  if(pending.has(key))return pending.get(key);
  if(pending.size>=4)throw fail(429,'Camera sources are busy. Try again shortly.');
  const promise=(async()=>{try{
   const adapter=require('./commons-template/tools/alpr.cjs'),bbox=[Math.max(-180,cell[0]-.3),Math.max(-85,cell[1]-.25),Math.min(180,cell[0]+.3),Math.min(85,cell[1]+.25)];
   const raw=await fetchOverpass(adapter.query(bbox).replace('timeout:90','timeout:25'));
   const now=new Date().toISOString(),body={format:'orient-alpr',version:1,updated:now,source:{name:'National plate-reader map',publisher:'OpenStreetMap contributors · DeFlock',homepage:'https://deflock.org/',license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',status:'ok',fetched:now,dataAsOf:raw.osm3s?.timestamp_osm_base||now},items:adapter.normalize(raw.elements)};
   alprCache.set(key,{at:Date.now(),body});while(alprCache.size>30)alprCache.delete(alprCache.keys().next().value);saveAlpr();return body;
  }catch{const kept=alprCache.get(key);if(kept&&Date.now()-kept.at<14*86400000)return {...kept.body,source:{...kept.body.source,status:'stale'}};throw fail(503,'The national camera map is temporarily unavailable. Try again shortly.');}finally{pending.delete(key);}})();
  pending.set(key,promise);return promise;
 };
 if(old&&Date.now()-old.at<14*86400000){refresh().catch(()=>{});return json(res,200,{...old.body,source:{...old.body.source,status:'stale'}});}
 return json(res,200,await refresh());
 }
 if(url==='/api/civic-connect/providers'){if(req.method!=='GET')throw fail(405,'Use GET.');return json(res,200,{checked:catalog.checked,providers:providers.map(({url,auth,...p})=>p)});}
 if(url==='/api/civic-connect/air'){rate(req);if(req.method!=='GET')throw fail(405,'Use GET.');return require('./civic.cjs').handle(req,res,json);}
 if(url==='/api/civic-connect'){if(req.method!=='POST')throw fail(405,'Use POST.');rate(req);if(connecting>=2)throw fail(429,'Civic connections are busy. Try again shortly.');let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>8192)throw fail(413,'Connection request is too large.');chunks.push(c);}let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{throw fail(400,'Invalid connection request.');}connecting++;try{return json(res,200,await connect(input,req.headers['x-orient-civic']));}finally{connecting--;}}
 const match=/^\/api\/civic-live\/([a-f0-9]{24})\/(roadwork|cameras|incidents|alpr)\.json$/.exec(url);if(!match)throw fail(404,'Civic source not found.');if(req.method!=='GET')throw fail(405,'Use GET.');const token=req.headers['x-orient-civic'];const value=unseal(token);if(id(token)!==match[1])throw fail(401,'Reconnect this civic source in Settings.');return json(res,200,await cached(value,match[2],match[1]));
 }catch(error){if(!res.headersSent)json(res,error.status||422,{error:error.status?error.message:'The source could not connect. Check your key or try again later.'});}}
 return {handle,connect,unseal,id,cached};
}
let service;module.exports={create,handle:(...args)=>(service||=create()).handle(...args)};
