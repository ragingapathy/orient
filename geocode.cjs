const photonURL=process.env.ORIENT_GEOCODER_URL||'https://photon.komoot.io/api/';
const censusURL=process.env.ORIENT_ADDRESS_GEOCODER_URL||'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const headers={'User-Agent':'OrientFieldMapPrototype/0.2 (personal city exploration prototype)','Accept':'application/json'};
function coordinatesValid(c){return Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&Math.abs(c[0])<=180&&Math.abs(c[1])<=85;}
async function request(url,fetcher){const res=await fetcher(url,{headers,signal:AbortSignal.timeout(15000)});if(!res.ok)throw new Error('Geocoder unavailable');return res.json();}
async function geocode(query,fetcher=fetch,options={}){
  const house=!options.city&&query.match(/^\s*(\d+[a-z]?(?:-\d+[a-z]?)?)\s+/i)?.[1];
  if(house){
    const url=new URL(censusURL);
    url.searchParams.set('address',query);url.searchParams.set('benchmark','Public_AR_Current');url.searchParams.set('format','json');
    const data=await request(url,fetcher);
    const zip=query.match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1];
    const results=(data.result?.addressMatches||[]).filter(m=>{
      const matchedHouse=m.matchedAddress?.match(/^\s*(\d+[a-z]?(?:-\d+[a-z]?)?)\s+/i)?.[1];
      return matchedHouse?.toLowerCase()===house.toLowerCase()&&(!zip||m.addressComponents?.zip===zip)&&coordinatesValid([m.coordinates?.x,m.coordinates?.y]);
    }).slice(0,5).map(m=>({name:m.matchedAddress,address:m.matchedAddress,coordinates:[m.coordinates.x,m.coordinates.y],source:'U.S. Census',accuracy:'Address matched · Estimated position along street'}));
    return {results,attribution:'U.S. Census Bureau',message:results.length?'Street address matched. The map position is estimated along the street, not a verified entrance.':'No matching street-number address found. Check the address, or use the map center or coordinates. Nearby roads and bus stops are not substitutes.'};
  }
  const url=new URL(photonURL);
  for(const [k,v]of Object.entries({q:query,limit:'5',lang:'en'}))url.searchParams.set(k,v);
  if(options.city){url.searchParams.append('layer','city');for(const tag of ['place:city','place:town','place:village','place:hamlet','place:municipality','boundary:administrative'])url.searchParams.append('osm_tag',tag);}
  else if(coordinatesValid(options.center)){url.searchParams.set('lon',options.center[0]);url.searchParams.set('lat',options.center[1]);}
  const data=await request(url,fetcher);
  const results=(Array.isArray(data.features)?data.features:[]).filter(f=>f.geometry?.type==='Point'&&coordinatesValid(f.geometry.coordinates)&&(!options.city||(f.properties?.osm_key==='place'&&/^(city|town|village|hamlet|municipality)$/.test(f.properties.osm_value))||(f.properties?.osm_key==='boundary'&&f.properties.osm_value==='administrative'))).slice(0,5).map(f=>{
    const p=f.properties||{};const street=[p.housenumber,p.street].filter(Boolean).join(' ');
    const address=[street,options.city?p.name:p.city||p.town||p.village||p.county,p.state,p.postcode,p.country].filter(Boolean).join(', ');
    const isStreet=p.osm_key==='highway'||p.type==='street';
    return {name:String(p.name||street||p.city||'Location').slice(0,150),address:String(address||p.name||'Location').slice(0,350),coordinates:f.geometry.coordinates,source:'Photon / OpenStreetMap',accuracy:isStreet?'Road or stop · Not a street-number address':p.housenumber?'Mapped address · Check the location':'Place match · Street number not verified'};
  });
  return {results,attribution:'Photon / OpenStreetMap contributors',message:results.length?(options.city?'Choose your city or town.':'Choose a place match. To locate a numbered address, include its street number, city, and state.'):'No matching places found. Try a full street address and city.'};
}
module.exports={geocode};
