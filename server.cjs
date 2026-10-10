const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain; charset=utf-8','.ttf':'font/ttf'};
const {geocode}=require('./geocode.cjs');
const {nearby}=require('./places.cjs');
const website=require('./website.cjs');
const sync=require('./sync.cjs');
const gidgit=require('./gidgit.cjs');
const commonsPublish=require('./commons-publish.cjs').createHandler();
const geocodeCache = new Map();
let geocodeBusy = false, lastGeocode = 0;
function json(res, status, data) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(data));
}
async function lookup(req, res) {
  if(req.method!=='POST'){res.writeHead(405,{Allow:'POST'});res.end();return;}
  let body='';
  try {
    for await(const chunk of req){body+=chunk;if(body.length>4096){json(res,413,{error:'Search text is too long.'});return;}}
    const input=JSON.parse(body);
    const query=typeof input.query==='string'?input.query.trim():'';
    if(query.length<3||query.length>250){json(res,400,{error:'Enter an address or place name, including the city.'});return;}
    const city=input.city===true;
    const center=Array.isArray(input.center)&&input.center.length===2&&input.center.every(Number.isFinite)&&Math.abs(input.center[0])<=180&&Math.abs(input.center[1])<=85?input.center:null;
    const key=JSON.stringify([query.toLowerCase(),city,center]);
    const cached=geocodeCache.get(key);
    if(cached&&Date.now()-cached.time<86400000){json(res,200,cached.data);return;}
    if(geocodeBusy||Date.now()-lastGeocode<1100){json(res,429,{error:'Please wait a moment, then try Find address again.'});return;}
    geocodeBusy=true;lastGeocode=Date.now();
    try{
      const result=await geocode(query,fetch,{city,center});
      if(geocodeCache.size>=200)geocodeCache.delete(geocodeCache.keys().next().value);
      geocodeCache.set(key,{time:Date.now(),data:result});json(res,200,result);
    }catch{json(res,502,{error:'Address lookup could not connect. Try again, or use the map center or coordinates.'});}finally{geocodeBusy=false;}
  } catch {if(!res.headersSent)json(res,400,{error:'Invalid search request.'});}
}
http.createServer((req,res)=>{
  let url;
  try { url = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch {res.writeHead(400);res.end('Bad request');return;}
  if(url.startsWith('/api/commons/')){commonsPublish(req,res,url,json,sync);return;}
  if(url==='/api/geocode'){lookup(req,res);return;}
  if(url==='/api/gidgit/settings'){gidgit.settings(req,res,json,sync);return;}
  if(url==='/api/gidgit'){gidgit.handle(req,res,json,sync);return;}
  if(sync.handle(req,res,url,json))return;
  if(url==='/api/website'){
    if(req.method!=='POST'){res.writeHead(405,{Allow:'POST'});res.end();return;}
    (async()=>{try{let body='';for await(const chunk of req){body+=chunk;if(body.length>4096){json(res,413,{error:'Website address is too long.'});return;}}const input=JSON.parse(body);if(typeof input.url!=='string'||input.url.length>2048){json(res,400,{error:'Enter a website address.'});return;}json(res,200,await website.inspect(input.url,{timeZone:typeof input.timeZone==='string'?input.timeZone:undefined}));}catch(e){json(res,e.status||502,{error:e.message||'Website could not be read.'});}})();return;
  }
  if(url==='/api/places'){
    if(req.method!=='POST'){res.writeHead(405,{Allow:'POST'});res.end();return;}
    (async()=>{try{let body='';for await(const chunk of req){body+=chunk;if(body.length>2048){json(res,413,{error:'Request too large.'});return;}}const input=JSON.parse(body);json(res,200,await nearby(input.lat,input.lng));}catch(e){json(res,e.status||502,{error:e.message||'Open map data is unavailable.'});}})();return;
  }
  const file = path.resolve(root, '.' + (url.endsWith('/') ? url+'index.html' : url));
  if (file !== root && !file.startsWith(root + path.sep)) {res.writeHead(403);res.end('Forbidden');return;}
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  fs.stat(file,(err,stat)=>{
    if(err || !stat.isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':path.basename(file).startsWith('maplibre')?'public, max-age=86400':'no-cache'});
    if(req.method==='HEAD')res.end();else fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  });
}).listen(port,host,()=>console.log(`Orient is running at http://${host}:${port}\nCloudflare tunnel origin: http://127.0.0.1:${port}`));
