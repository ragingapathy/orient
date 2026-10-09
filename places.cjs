const endpoint=process.env.ORIENT_OVERPASS_URL||'https://overpass-api.de/api/interpreter';
const cache=new Map();let busy=false,lastRequest=0,cooldown=0,dailyCount=0,dailyDay='';
function safeURL(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function category(t){
 const shop=t.shop||'',amenity=t.amenity||'';
 const types={comics:['Comic shop','book-open','books-games'],books:['Bookshop','book-open','books-games'],video_games:['Video games','gamepad-2','books-games'],games:['Game shop','dices','books-games'],toys:['Toy shop','puzzle','books-games'],hobby:['Hobby shop','puzzle','books-games'],library:['Library','library','books-games'],cafe:['Café','coffee','food'],restaurant:['Restaurant','utensils','food'],fast_food:['Food','utensils','food'],pub:['Pub','glass-water','food'],bar:['Bar','glass-water','food'],community_centre:['Community space','users','community'],arts_centre:['Arts space','palette','community'],cinema:['Cinema','film','culture'],theatre:['Theatre','drama','culture']};
 if(types[shop]||types[amenity])return types[shop]||types[amenity];
 if(t.leisure==='park')return ['Park','trees','outdoors'];
 if(t.tourism)return [String(t.tourism).replaceAll('_',' '),'landmark','culture'];
 return [(shop||amenity||t.leisure||'Place').replaceAll('_',' '),'map-pin',shop?'shop':'other'];
}
function normalize(elements,retrievedAt){
 const results=[];
 for(const e of elements){
  const t=e.tags||{};const lat=e.lat??e.center?.lat,lng=e.lon??e.center?.lon;
  if(!['node','way','relation'].includes(e.type)||!Number.isSafeInteger(e.id)||!t.name||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180||t.disused==='yes'||t.abandoned==='yes'||t.shop==='vacant')continue;
  const [kind,icon,group]=category(t);
  const address=[[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' '),t['addr:city'],t['addr:state'],t['addr:postcode']].filter(Boolean).join(', ');
  const p={id:`osm-${e.type}-${e.id}`,name:String(t.name).slice(0,150),kind,icon,group,coordinates:[lng,lat],address,hours:String(t.opening_hours||'').slice(0,500),website:safeURL(t.website||t['contact:website']),phone:String(t.phone||t['contact:phone']||'').slice(0,100),wheelchair:String(t.wheelchair||'').slice(0,60),operator:String(t.operator||'').slice(0,150),description:String(t.description||'').slice(0,800),sourceURL:`https://www.openstreetmap.org/${e.type}/${e.id}`,retrievedAt,osmEditedAt:e.timestamp||'',demo:false};
  // A mapped node inside the same named building is one discovery, not two.
  const duplicate=results.find(r=>r.name.toLowerCase()===p.name.toLowerCase()&&Math.abs(r.coordinates[0]-lng)<.00025&&Math.abs(r.coordinates[1]-lat)<.00025);
  if(duplicate){if(Object.values(p).filter(Boolean).length>Object.values(duplicate).filter(Boolean).length)results[results.indexOf(duplicate)]=p;}else results.push(p);
 }
 return results;
}
async function nearby(lat,lng,fetcher=fetch){
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180)throw Object.assign(new Error('Choose a valid map location.'),{status:400});
 const key=`${lat.toFixed(4)},${lng.toFixed(4)}`;const existing=cache.get(key);
 if(existing&&Date.now()-existing.time<86400000)return {...existing.data,cached:true};
 const today=new Date().toISOString().slice(0,10);if(today!==dailyDay){dailyDay=today;dailyCount=0;}
 if(busy||Date.now()-lastRequest<2000||Date.now()<cooldown||dailyCount>=90)throw Object.assign(new Error('Open map data is busy. Please wait before trying again.'),{status:429});
 busy=true;lastRequest=Date.now();dailyCount++;
 try{
  const query=`[out:json][timeout:20];(nwr(around:800,${lat.toFixed(6)},${lng.toFixed(6)})[name][shop];nwr(around:800,${lat.toFixed(6)},${lng.toFixed(6)})[name][amenity~"^(library|cafe|restaurant|fast_food|pub|bar|community_centre|arts_centre|cinema|theatre|social_facility|marketplace)$"];nwr(around:800,${lat.toFixed(6)},${lng.toFixed(6)})[name][tourism];nwr(around:800,${lat.toFixed(6)},${lng.toFixed(6)})[name][leisure~"^(park|sports_centre|fitness_centre)$"];);out meta center 150;`;
  const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'OrientFieldMapPrototype/0.3 (small personal city discovery prototype)','Accept':'application/json'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(25000)});
  if(!response.ok){if([429,406,504].includes(response.status))cooldown=Date.now()+30000;throw new Error('Open map data could not be reached. Try again later.');}
  const data=await response.json();if(data.remark)throw new Error('Open map data did not finish loading. Try again later.');
  const retrievedAt=new Date().toISOString();const result={places:normalize(data.elements||[],retrievedAt),retrievedAt,radius:800,attribution:'© OpenStreetMap contributors',cached:false};
  if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{data:result,time:Date.now()});return result;
 }finally{busy=false;}
}
module.exports={nearby,normalize,safeURL};
