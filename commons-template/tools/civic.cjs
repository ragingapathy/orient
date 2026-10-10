 'use strict';
const AIR='https://files.airnowtech.org/airnow/today/reportingarea.dat';
const PARK='https://gis.toledo.oh.gov/arcgis/rest/services/Internal/ForestryEditing/FeatureServer/5';
const distance=(a,b)=>{const r=Math.PI/180,h=Math.sin((a[1]-b[1])*r/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin((a[0]-b[0])*r/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));};
const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85;
const offsets={EST:-5,EDT:-4,CST:-6,CDT:-5,MST:-7,MDT:-6,PST:-8,PDT:-7,AKST:-9,AKDT:-8,HST:-10,AST:-4,ADT:-3};
function airRows(text,center,now=Date.now()){
 const rows=[];
 for(const line of text.split(/\r?\n/)){const f=line.split('|');if(f.length<17||f[5]!=='O'||!f[12].trim())continue;
 const coordinates=[Number(f[10]),Number(f[9])],aqi=Number(f[12]);if(!point(coordinates)||distance(center,coordinates)>100||!Number.isFinite(aqi)||aqi<0||aqi>500)continue;
 const date=f[1].match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/),time=f[2].match(/^(\d{1,2}):(\d{2})$/),offset=offsets[f[3]];if(!date||!time||offset===undefined)continue;
 const year=+date[3]<100?2000+(+date[3]):+date[3],stamp=Date.UTC(year,+date[1]-1,+date[2],+time[1]-offset,+time[2]);
 if(now-stamp>4*3600e3||stamp>now+3600e3)continue;
 rows.push({area:f[7],state:f[8],coordinates,pollutant:f[11],aqi,category:f[13],observedAt:new Date(stamp).toISOString(),localTime:f[1]+' '+f[2]+' '+f[3],agency:f[16],preliminary:true,sourceURL:AIR});}
 rows.sort((a,b)=>distance(center,a.coordinates)-distance(center,b.coordinates));if(!rows.length)return [];
 const nearest=rows[0];return rows.filter(r=>r.area===nearest.area&&r.state===nearest.state).filter(r=>!rows.some(other=>other.area===r.area&&other.pollutant===r.pollutant&&other.observedAt>r.observedAt));
}
function parks(raw){return (raw.features||[]).flatMap(f=>{
 const a=f.attributes||f.properties||{},g=f.geometry,coordinates=g&&[g.x,g.y];if(!point(coordinates)||!a.Name||!/^Open(?:_Fee)?$/i.test(a.ParkStatus||''))return [];
 const amenities=Object.entries({Restroom:'Restrooms',DrinkingFountain:'Drinking water',ParkBench:'Benches',ParkingLot:'Parking',PicnicShelter:'Picnic shelter',PlayEquipment:'Playground'}).filter(([key])=>/^(yes|y|1|true)$/i.test(String(a[key]||''))).map(([,label])=>label);
 return amenities.length?[{id:'toledo-park-'+a.OBJECTID,name:String(a.Name),coordinates,amenities,fee:a.ParkStatus==='Open_Fee',position:'park-level',source:'City of Toledo',sourceURL:PARK}]:[];});}
async function download(url,fetcher=fetch){const r=await fetcher(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Source unavailable (HTTP '+r.status+')');const text=await r.text();if(text.length>12*1024*1024)throw Error('Source file too large');return text;}

const EIA_RSS='https://www.eia.gov/petroleum/gasdiesel/includes/gas_diesel_rss.xml';
function fuelRSS(xml,areas){
 const item=xml.match(/<item>[\s\S]*?<\/item>/)?.[0]||'',date=item.match(/Data For (\d{2})\/(\d{2})\/(\d{2})/);if(!date)return [];
 const period='20'+date[3]+'-'+date[1]+'-'+date[2];
 const description=(item.match(/<description>([\s\S]*?)<\/description>/)?.[1]||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 const regular=description.split(/On-Highway/i)[0],lines=regular.split(/<br\s*\/?\s*>/i).map(s=>s.replace(/<[^>]*>/g,'').trim());
 const names={SOH:'Ohio',R20:'Midwest',NUS:'U.S.',YCLE:'Cleveland'};
 return areas.flatMap(area=>{const line=lines.find(l=>{const m=l.match(/^([0-9]+\.[0-9]+)\s+\.+\s*(.+)$/);return m&&m[2].trim()===(names[area.id]||area.name);}),m=line?.match(/^([0-9]+\.[0-9]+)/);return m?[{area:area.name,areaId:area.id,grade:'Regular',price:Number(m[1]),unit:'USD/gallon',period,source:'U.S. Energy Information Administration',sourceURL:EIA_RSS}]:[];});
}

async function collect(config,{fetcher=fetch,now=Date.now()}={}){
 if(!point(config.center)||!config.sourceId)throw Error('Set civic sourceId and center');
 const out={format:'orient-civic',version:1,sourceId:config.sourceId,center:config.center,updated:new Date(now).toISOString(),air:[],amenities:[],fuel:[],sources:[]};
 async function source(id,license,fn){try{await fn();out.sources.push({id,status:'ok',license});}catch{out.sources.push({id,status:'unavailable',license});}}
 if(config.airnow)await source('airnow','AirNow Data Exchange Guidelines',async()=>{out.air=airRows(await download(AIR,fetcher),config.center,now);});
 if(config.toledoAmenities&&distance(config.center,[-83.539,41.655])<60)await source('toledo-parks','Reuse terms to be confirmed; local display only',async()=>{
 const u=new URL(PARK+'/query');u.search=new URLSearchParams({where:'1=1',outFields:'OBJECTID,Name,Restroom,DrinkingFountain,ParkBench,ParkingLot,PicnicShelter,PlayEquipment,ParkStatus',returnGeometry:'true',returnCentroid:'true',outSR:'4326',f:'json',resultRecordCount:'1000'});
 const data=JSON.parse(await download(u,fetcher));if(data.error)throw Error('Parks unavailable');
 out.amenities=parks({features:(data.features||[]).map(f=>({...f,geometry:f.centroid||f.geometry}))});});
 if(config.eiaAreas?.length&&process.env.EIA_API_KEY)await source('eia','Public domain; EIA attribution and publication date',async()=>{
 for(const area of config.eiaAreas.slice(0,3)){
 const u=new URL('https://api.eia.gov/v2/petroleum/pri/gnd/data/');u.search=new URLSearchParams({api_key:process.env.EIA_API_KEY,frequency:'weekly','data[0]':'value','facets[duoarea][]':area.id,'facets[product][]':'EPMR','facets[process][]':'PTE','sort[0][column]':'period','sort[0][direction]':'desc',length:'1'});
 const raw=JSON.parse(await download(u,fetcher)),r=raw.response?.data?.[0];if(!r||!Number.isFinite(Number(r.value)))continue;
 out.fuel.push({area:area.name,areaId:area.id,grade:'Regular',price:Number(r.value),unit:'USD/gallon',period:r.period,source:'U.S. Energy Information Administration',sourceURL:'https://www.eia.gov/petroleum/gasdiesel/'});}});
 else if(config.eiaAreas?.length)await source('eia','Public domain; EIA attribution and publication date',async()=>{out.fuel=fuelRSS(await download(EIA_RSS,fetcher),config.eiaAreas);if(!out.fuel.length)throw Error('No matching EIA area in feed');});
 return out;
}
module.exports={collect,airRows,parks,distance,point,fuelRSS};
