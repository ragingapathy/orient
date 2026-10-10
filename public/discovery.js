'use strict';
window.OrientPlaces=(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=n=>`<i data-lucide="${n}" aria-hidden="true"></i>`;
 const safeURL=s=>{try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
 const distance=(a,b)=>{const r=Math.PI/180,lat=(b[1]-a[1])*r,lng=(b[0]-a[0])*r;const h=Math.sin(lat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(lng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));};
 const group=p=>p.group&&p.group!=='other'?p.group:(/comic|book|game|hobby|toy|library/i.test(p.kind+' '+p.name)?'books-games':/food|café|cafe|coffee|restaurant/i.test(p.kind)?'food':'other');
 function sanitize(p){
  if(!p||!/^((osm-(node|way|relation)-\d+)|(tile-[a-z0-9]+))$/.test(p.id)||typeof p.name!=='string'||!Array.isArray(p.coordinates)||p.coordinates.length!==2||!p.coordinates.every(Number.isFinite)||Math.abs(p.coordinates[0])>180||Math.abs(p.coordinates[1])>85)return null;
  const type=p.id.split('-')[1],id=p.id.split('-')[2];
  const iconName=['book-open','gamepad-2','dices','puzzle','library','coffee','utensils','glass-water','users','palette','film','drama','trees','landmark','map-pin'].includes(p.icon)?p.icon:'map-pin';
  const tile=p.id.startsWith('tile-');
  const obj={id:p.id,name:p.name.slice(0,150),kind:String(p.kind||'Place').slice(0,80),icon:iconName,group:String(p.group||'other').slice(0,40),coordinates:p.coordinates,demo:false,mapLabelOnly:tile,sourceURL:tile?`https://www.openstreetmap.org/?mlat=${p.coordinates[1]}&mlon=${p.coordinates[0]}#map=18/${p.coordinates[1]}/${p.coordinates[0]}`:`https://www.openstreetmap.org/${type}/${id}`,website:tile?'':safeURL(p.website)};
  for(const key of ['address','hours','phone','wheelchair','operator','description','retrievedAt','osmEditedAt'])obj[key]=String(p[key]||'').slice(0,key==='description'?800:500);
  return obj;
 }
 function fromFeature(f){
  const props=f.properties||{},name=props.name||props['name:en'];
  if(!name||f.geometry?.type!=='Point')return null;
  const coordinates=f.geometry.coordinates.slice(0,2),text=`${props.class||''} ${props.subclass||''}`.toLowerCase();
  const category=/comic/.test(text)?['Comic shop','book-open','books-games']:/video_game|games|gaming/.test(text)?['Game shop','gamepad-2','books-games']:/books|library/.test(text)?['Books & reading','library','books-games']:/cafe|coffee/.test(text)?['Café','coffee','food']:/restaurant|food/.test(text)?['Food & drink','utensils','food']:/park/.test(text)?['Park','trees','outdoors']:['Place','map-pin','other'];
  let hash=2166136261;for(const c of `${name.toLowerCase()}:${coordinates.map(n=>n.toFixed(4)).join(',')}`){hash=Math.imul(hash^c.charCodeAt(0),16777619);}
  return sanitize({id:'tile-'+(hash>>>0).toString(36),name,kind:category[0],icon:category[1],group:category[2],coordinates,retrievedAt:new Date().toISOString()});
 }
 function nearbyMarkup(anchor,places,saved,visited){
  const candidates=places.filter(p=>p.id!==anchor.id&&!p.demo&&!saved.includes(p.id)&&!visited.includes(p.id)&&!(p.name.toLowerCase()===anchor.name.toLowerCase()&&distance(p.coordinates,anchor.coordinates)<150)).map(p=>({p,d:distance(anchor.coordinates,p.coordinates),related:group(anchor)!=='other'&&group(anchor)===group(p)})).filter(o=>o.d<=800).sort((a,b)=>Number(b.related)-Number(a.related)||a.d-b.d).slice(0,4);
  return candidates.map(({p,d,related})=>`<button class="discovery-row" data-place="${esc(p.id)}"><span class="discovery-symbol">${icon(p.icon)}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.kind)} · ${Math.max(10,Math.round(d/10)*10)} m away</small><small>${related?'Related to this place':'Nearby'} · Not on your map</small></span>${icon('chevron-right')}</button>`).join('');
 }
 function freshnessPill(retrievedAt){
  if(!retrievedAt)return '';
  const days=Math.floor((Date.now()-new Date(retrievedAt).getTime())/86400000);
  const label=days<30?'Verified':days<90?'Check soon':'Stale';
  const cls=days<30?'fresh':days<90?'stale':'old';
  return `<span class="freshness-pill ${cls}" title="Retrieved ${new Date(retrievedAt).toLocaleDateString()}">${label}</span>`;
 }
 function card(p,{saved,visited,expanded,discovery,glance='',knowledge='',websiteSection='',rating=0,visits={}}){
  const ratingUI=`<fieldset class="personal-rating"><legend>Your rating${rating?' · '+rating+'/5':''}</legend><div>${[1,2,3,4,5].map(n=>`<label class="rating-star ${n<=rating?'rated':''}"><input type="radio" name="place-rating" value="${n}" aria-label="${n} out of 5 stars" ${rating===n?'checked':''}>${icon('star')}</label>`).join('')}${rating?'<button type="button" data-action="clear-rating" class="clear-rating" aria-label="Clear your rating">Clear</button>':''}</div></fieldset>`;
  const sourced=!!p.sourceURL;
  const status=p.demo?p.hours:p.profileHours?'Hours listed':sourced?(p.hours?'Hours listed · Not confirmed':'Hours unknown'):'Your place';
  const source=sourced?`<details class="source-facts"><summary>Sources & freshness</summary><p class="fine"><a href="${esc(p.sourceURL)}" target="_blank" rel="noopener">${p.mapLabelOnly?'Open map location':p.sourceURL.includes('openstreetmap.org')?'OpenStreetMap source':'Listing source'}</a> · Retrieved ${p.retrievedAt?esc(new Date(p.retrievedAt).toLocaleDateString()):'date unavailable'}<br>${p.mapLabelOnly?'Map label only · Fuller details unavailable.<br>':''}Human confirmation: unknown.${p.osmEditedAt?'<br>Record edited '+esc(p.osmEditedAt.slice(0,10))+'; this does not verify individual facts.':''}</p></details>`:'';
  return `<button class="grip" data-action="expand" aria-label="${expanded?'Collapse':'Expand'} place details" aria-expanded="${expanded}"><span></span></button><div class="peekhead"><span class="tile">${icon(p.icon)}</span><div class="placecopy"><h2>${esc(p.name)}</h2><div class="meta"><b>${esc(status)}</b> · <button class="category-label" data-action="edit-category" aria-label="Change category">${esc(p.kind)} ${icon('chevron-down')}</button>${freshnessPill(p.retrievedAt)}</div></div><button class="save" data-action="save" aria-label="${saved?'Unsave':'Save'} ${esc(p.name)}" aria-pressed="${saved}">${icon(saved?'bookmark-check':'bookmark')}</button>${visits.button||''}</div>${expanded?ratingUI:''}${glance}${p.specials?.length?`<div class="eventline">${icon('calendar-days')}<span><strong>${p.specials.length} recurring specials</strong> · See Calendar</span></div>`:''}${p.event?`<div class="eventline">${icon('calendar-days')}<span><strong>${esc(p.event)}</strong> · ${p.eventDay==='SAT'?'Sat':'Sun'} · ${p.eventTime}</span></div>`:(visited?`<div class="eventline">${icon('circle-check')}<span>${visits.line||'A place you’ve made familiar'}</span></div>`:'')}${expanded?'':`<button class="expand" data-action="expand" aria-expanded="false">Explore this place${icon('chevron-up')}</button>`}${expanded?`<div class="detail">${p.note||p.description?`<p>${esc(p.note||p.description)}</p>`:''}<div class="actions">${p.demo?'<button class="button primary" data-action="demo-directions">Demo location</button>':`<a class="button primary" ${OrientDirections.attrs(p.coordinates,p.name,'driving')}>${icon('navigation')}Directions</a>`}</div>${visits.section||''}${knowledge}${!p.demo?discovery:''}${websiteSection}${source}${p.demo?`<button class="expand" data-action="discussion">Place conversations ${icon('arrow-up-right')}</button>`:p.id.startsWith('local-')?`<div class="manage"><button class="quiet" data-action="edit-place">${icon('pencil')}Edit place or address</button><button class="quiet danger" data-action="delete-place">${icon('trash-2')}Remove from your map</button></div>`:`<button class="quiet" data-action="nearby">${icon('search')}Nearby places</button><button class="quiet" data-action="discussion">${icon('message-circle')}Place conversations</button>`}</div>`:''}`;
 }
 return {sanitize,distance,group,nearbyMarkup,card,fromFeature};
})();
