'use strict';
(() => {
  const KEY = 'orient-field-map-v1';
  const $ = s => document.querySelector(s);
  const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const icons = () => window.lucide?.createIcons({attrs:{'stroke-width':1.8}});
  // Places come from catalog.local.js (yours, not committed) or catalog.sample.js (a few made-up examples).
  const demoPlaces = Array.isArray(window.ORIENT_CATALOG) ? window.ORIENT_CATALOG : [];
  const threads = [];
  const kindIcons = {'Photo memory':'camera','Comic shop':'book-open',Library:'library','Public space':'trees','Community space':'users','Food & drink':'coffee','Food pantry':'utensils','Thrift store':'shopping-bag','Coffee shop':'coffee','Dog park':'bone',Clinic:'heart-pulse',Dispensary:'leaf','Civic rooms':'landmark',Other:'map-pin'};
  const cleanCategory=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').trim().replace(/\s+/g,' ').slice(0,48):'';
  const categoryIcon=kind=>kindIcons[kind]||(/auto|mechanic|repair/i.test(kind)?'wrench':'map-pin');
  function cleanData(raw) {
    if (!raw || raw.version !== 1) throw new Error('This is not an Orient map export.');
    const custom = (Array.isArray(raw.custom) ? raw.custom : []).slice(0,500).filter(p => p && typeof p.id === 'string' && p.id.startsWith('local-') && typeof p.name === 'string' && p.name.trim() && Array.isArray(p.coordinates) && p.coordinates.length === 2 && p.coordinates.every(Number.isFinite) && Math.abs(p.coordinates[0])<=180 && Math.abs(p.coordinates[1])<=85).map(p => ({id:p.id.slice(0,100),name:p.name.trim().slice(0,100),kind:cleanCategory(p.kind)||'Other',icon:categoryIcon(cleanCategory(p.kind)),coordinates:p.coordinates,photoMemory:p.photoMemory===true,address:String(p.address||'').slice(0,250),note:String(p.note||'').slice(0,800),demo:false}));
    const unique = [...new Map(custom.map(p=>[p.id,p])).values()];
    const osm=(Array.isArray(raw.osm)?raw.osm:[]).slice(0,500).map(OrientPlaces.sanitize).filter(Boolean);
    const ids = new Set([...demoPlaces,...unique,...osm].map(p=>p.id));
    const pick = a => [...new Set(Array.isArray(a)?a.filter(v=>ids.has(v)):[])];
    const drafts = {};
    for (const thread of threads) {
      drafts[thread.id] = (Array.isArray(raw.drafts?.[thread.id])?raw.drafts[thread.id]:[]).slice(-100).filter(d=>d&&typeof d.text==='string').map(d=>({text:d.text.slice(0,2000),date:typeof d.date==='string'?d.date.slice(0,40):''}));
    }
    const ratings={};for(const [id,value]of Object.entries(raw.ratings||{}))if(ids.has(id)&&Number.isInteger(value)&&value>=1&&value<=5)ratings[id]=value;
    const visitedPick=pick(raw.visited),visitLog=OrientVisits.clean(raw,ids,visitedPick);
    return {version:1,home:OrientHome.clean(raw.home)||(OrientCatalog.legacy(raw)?OrientHome.legacy():null),useCatalog:Boolean(OrientCatalog.needed(raw)),photos:OrientPhotos.clean(raw.photos,ids),circuits:OrientCircuits.clean(raw.circuits,ids),collections:OrientCollections.clean(raw.collections,ids),journey:OrientJourney.clean(raw.journey),neighbors:OrientNeighbors.clean(raw.neighbors),commons:OrientCommonsData.clean(raw.commons,ids),custom:unique,osm,ratings,saved:pick(raw.saved),visited:[...new Set([...visitedPick,...Object.keys(visitLog)])],visitLog,heat:raw.heat===true,visitDays:[0,14,30].includes(raw.visitDays)?raw.visitDays:14,drafts,...OrientCalendar.clean(raw,ids),web:OrientWebsite.clean(raw.web,ids),showDemo:raw.showDemo!==false,fog:raw.fog!==false};
  }
  let store = {version:1,home:null,useCatalog:false,custom:[],osm:[],ratings:{},saved:[],visited:[],visitLog:{},heat:false,visitDays:14,drafts:{},details:{},events:[],showDemo:true,fog:true};
  let storageWorks = true;
  try { const raw = localStorage.getItem(KEY); if(raw) store = cleanData(JSON.parse(raw)); } catch { storageWorks=false; }
  const state = {tab:'Explore',selected:null,exploreHome:true,briefingExpanded:false,expanded:false,list:false,filter:'Everything',query:'',filters:false,thread:null,category:'All categories',relationship:'Any',happening:'Any time',radius:'Any distance',sort:'Nearby first',origin:OrientAreas.area()?.coordinates||store.home?.coordinates||[0,20],originLabel:OrientAreas.area()?.name||store.home?.name||'your chosen area'};
  let map = null;
  const markers = new Map();
  let mapLoaded=false,toastTimer;
  const discoveries=new Map(),enrichments=new Map(),nearbyStates=new Map();
  let discoveryBusy=false;
  const allPlaces=()=>[...new Map([...demoPlaces.filter(p=>store.useCatalog&&(!p.demo||store.showDemo)),...store.custom,...(store.osm||[]),...discoveries.values()].map(p=>[p.id,enrichments.has(p.id)?{...p,...enrichments.get(p.id),id:p.id,name:p.name,coordinates:p.coordinates,note:p.note}:p])).values()].map(p=>store.details?.[p.id]?.category?{...p,baseKind:p.kind,kind:store.details[p.id].category,icon:categoryIcon(store.details[p.id].category)}:p);
  const placeById=id=>allPlaces().find(p=>p.id===id);
  const isMarked=id=>store.saved.includes(id)||store.visited.includes(id);
  const collected=id=>(store.collections||[]).some(c=>c.places.includes(id));
  function personalCategories(){return [...new Set([...allPlaces().map(p=>p.kind),...Object.values(store.details||{}).map(v=>v.category)].map(cleanCategory).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
  function categoryOptions(){return [...new Set([...Object.keys(kindIcons),...personalCategories()])];}
  function refreshCategoryOptions(){document.querySelector('#place-categories').innerHTML=categoryOptions().map(k=>`<option value="${escapeHTML(k)}"></option>`).join('');}
  function canonicalCategory(value){const clean=cleanCategory(value);return categoryOptions().find(k=>k.toLocaleLowerCase()===clean.toLocaleLowerCase())||clean;}
  function editCategory(){const p=placeById(state.selected);if(!p)return;refreshCategoryOptions();const dlg=document.querySelector('#category-dialog');dlg.innerHTML=`<form><div class="panel-heading"><h2>Your category</h2><button type="button" class="icon-button" data-action="close-category" aria-label="Close category">${icon('x')}</button></div><p class="sub">${escapeHTML(p.name)}</p><label>Category<input name="category" list="place-categories" maxlength="48" required value="${escapeHTML(p.kind)}" autocomplete="off"></label><p class="fine">Choose a category or type a new one, like Auto. Saving makes it available for your other places and filters.</p><button class="button primary full">Save category</button>${store.details?.[p.id]?.category?'<button type="button" class="button full" data-action="default-category">Use original category</button>':''}</form>`;dlg.querySelector('form').onsubmit=e=>{e.preventDefault();const category=canonicalCategory(new FormData(e.target).get('category'));if(!category)return;privatePlaceAPI.keep(p.id);store.details||={};store.details[p.id]={...(store.details[p.id]||{}),category};save();dlg.close();render();};dlg.showModal();icons();}
  const filterDefaults={category:'All categories',relationship:'Any',happening:'Any time',radius:'Any distance',sort:'Nearby first'};
  const categoryOf=p=>store.details?.[p.id]?.category||(!Object.hasOwn(kindIcons,p.kind)&&store.custom.some(c=>c.id===p.id)?p.kind:'')||(/pantry|resource|shelter|community|social/i.test(p.kind)?'Resources':/food|drink|cafe|coffee|restaurant/i.test(p.kind)?'Food & drink':/shop|comic|book|game|store/i.test(p.kind)?'Shops':/public|park|library/i.test(p.kind)?'Public spaces':'Other');
  const distanceMiles=p=>OrientPlaces.distance(state.origin,p.coordinates)/1609.344;
  const activeFilters=()=>Object.entries(filterDefaults).filter(([k,v])=>state[k]!==v).map(([k])=>[k,state[k]]);
  function filterChips(){return '<div class="active-filters">'+activeFilters().map(([k,v])=>`<button class="button" data-clear-filter="${k}" aria-label="Remove ${escapeHTML(v)} filter">${escapeHTML(v)} ×</button>`).join('')+(state.filter!=='Everything'?`<button class="button" data-filter="Everything" aria-label="Remove ${escapeHTML(state.filter)} filter">${escapeHTML(state.filter)} ×</button>`:'')+((activeFilters().length||state.filter!=='Everything')?'<button class="button" data-action="clear-filters">Clear filters</button>':'')+'</div>';}
  function exploreControls(compact=false){const select=(key,label,options)=>`<label>${label}<select data-explore-filter="${key}" aria-label="${label}">${options.map(v=>`<option ${state[key]===v?'selected':''}>${escapeHTML(v)}</option>`).join('')}</select></label>`;return '<div class="explore-filter-grid'+(compact?' list-filter-grid':'')+'">'+select('category','Category',[...new Set(['All categories','Food & drink','Shops','Resources','Public spaces','Other',...categoryOptions()])])+select('relationship','Your relationship',['Any','Unvisited','Saved','Visited','Rated'])+select('happening','What’s happening',['Any time','Specials today','Upcoming events'])+select('radius','Within',['Any distance','1 mile','3 miles','5 miles','10 miles'])+select('sort','Sort by',['Nearby first','Name A–Z'])+'</div>'+(compact?'':'<p class="fine">Distance from '+(state.originLabel||store.home?.name||'your chosen area')+'. Upcoming events cover the next 7 days. Unknown hours aren’t treated as open.</p><button class="button" data-action="filter-center">Measure from map center</button><button class="button" data-action="filters">Done</button>');}
  const hoursFor=p=>OrientWebsite.hoursFor(p,store.details?.[p.id]?.hours||'');
  const opening=p=>p.demo?{state:'unknown',label:'Demo hours'}:OrientHours.status(hoursFor(p),new Date(),OrientHome.timeZone());
  function visiblePlaces(){let list=allPlaces().filter(p=>(state.tab!=='My Map'||isMarked(p.id)||collected(p.id)||discoveries.has(p.id))&&(!state.query||`${p.name} ${p.kind} ${p.event||''} ${p.address} ${p.note||''} ${(p.specials||[]).map(s=>s.title).join(' ')}`.toLowerCase().includes(state.query))&&(state.filter!=='Specials'||p.specials?.length>0)&&((state.filter!=='Open now')||opening(p).state==='open')&&(state.filter!=='Free events'||p.eventPrice==='Free'));
    if(state.tab==='My Map'&&state.collectionId){const c=OrientCollections.get(state.collectionId);if(c)list=list.filter(p=>c.places.includes(p.id));}
    if(state.tab!=='Explore')return list;
    let happening=null;if(state.happening!=='Any time'){const from=OrientCalendar.today(),to=state.happening==='Specials today'?from:OrientDates.fromNum(OrientDates.toNum(from)+6);happening=new Set(OrientCalendar.occurrences(OrientWebsite.allEvents(),from,to).filter(e=>OrientCalendar.attendable(e)).filter(e=>state.happening!=='Specials today'||e.kind==='Special').map(e=>e.placeId));}
    list=list.filter(p=>(state.category==='All categories'||categoryOf(p)===state.category||p.kind===state.category)&&(state.relationship==='Any'||(state.relationship==='Unvisited'?!store.visited.includes(p.id):state.relationship==='Saved'?store.saved.includes(p.id):state.relationship==='Visited'?store.visited.includes(p.id):!!store.ratings?.[p.id]))&&(!happening||happening.has(p.id))&&(state.radius==='Any distance'||distanceMiles(p)<=parseFloat(state.radius)));
    return list.sort((a,b)=>state.sort==='Nearby first'?distanceMiles(a)-distanceMiles(b)||a.name.localeCompare(b.name):a.name.localeCompare(b.name));
  }

  function save() { const earned=OrientJourney.sync();try { localStorage.setItem(KEY,JSON.stringify(store)); storageWorks=true;window.OrientSync?.changed();if(earned.length)queueMicrotask(()=>toast(earned.map(m=>m.name).join(' · ')+' · +'+earned.reduce((n,m)=>n+m.points,0)+' points'));return true; } catch {storageWorks=false;toast('Browser storage is unavailable or full. Export your map to keep these changes.');return false;} }
  function toast(message) {clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,5000);}
  function keepOsm(id){const p=placeById(id);if(p&&/^(osm-|tile-)/.test(id)&&!(store.osm||[]).some(x=>x.id===id))store.osm=[...(store.osm||[]),OrientPlaces.sanitize(p)].filter(Boolean);}
  function toggleMark(key,id) {const p=placeById(id);if(p&&/^(osm-|tile-)/.test(id)&&!(store.osm||[]).some(p=>p.id===id))store.osm=[...(store.osm||[]),OrientPlaces.sanitize(p)].filter(Boolean);store[key]=store[key].includes(id)?store[key].filter(v=>v!==id):[...store[key],id];store.osm=(store.osm||[]).filter(p=>isMarked(p.id)||collected(p.id)||store.ratings?.[p.id]||store.details?.[p.id]||(store.events||[]).some(e=>e.placeId===p.id)||store.web?.profiles?.[p.id]||store.web?.urls?.[p.id]||store.web?.sources?.some(s=>s.placeId===p.id));save();render();}
  function tileCandidates(anchor){
    if(!map)return [];
    const found=new Map();
    for(const [id,source]of Object.entries(map.getStyle()?.sources||{}))if(source.type==='vector'){
      try{for(const feature of map.querySourceFeatures(id,{sourceLayer:'poi'})){const p=OrientPlaces.fromFeature(feature);if(p&&OrientPlaces.distance(p.coordinates,anchor.coordinates)<=800)found.set(p.id,p);}}catch{}
    }
    return [...found.values()].sort((a,b)=>Number(OrientPlaces.group(b)===OrientPlaces.group(anchor))-Number(OrientPlaces.group(a)===OrientPlaces.group(anchor))||OrientPlaces.distance(a.coordinates,anchor.coordinates)-OrientPlaces.distance(b.coordinates,anchor.coordinates)).slice(0,16);
  }
  function discoverySection(p){
    const status=nearbyStates.get(p.id);
    const rows=OrientPlaces.nearbyMarkup(p,[...discoveries.values()],store.saved,store.visited);
    return `<section class="nearby-section"><div class="nearby-heading"><h3>Near this place</h3><span class="tag">DISCOVER</span></div>${rows}${!rows||status?.error?`<p class="fine">${escapeHTML(status?.message||'Find neighboring places you might want to know.')}</p>`:''}<button class="button full" data-action="nearby" ${discoveryBusy?'disabled':''}>${icon('radar')}${status?.loading?'Looking around…':status?.loaded?'Look around again':'Look around this place'}</button><p class="fine">Within 800 m · Straight-line distance, not a walking route.<br>Loads open map data for this location. Suggestions stay unsaved.</p></section>`;
  }
  async function loadNearby(anchor,{mapName=null}={}){
    if(discoveryBusy){toast('Already looking around. Please wait a moment.');return;}
    const anchorId=anchor.id;discoveryBusy=true;nearbyStates.set(anchorId,{loading:true,message:'Looking for open map places…'});
    if(map&&map.getZoom()<16){
      map.easeTo({center:anchor.coordinates,zoom:16,offset:matchMedia('(min-width:760px)').matches?[140,0]:[0,-150],duration:matchMedia('(prefers-reduced-motion:reduce)').matches?0:300});
      await new Promise(resolve=>{const finish=()=>{map.off('idle',finish);clearTimeout(timer);resolve();};const timer=setTimeout(finish,4000);map.once('idle',finish);});
    }
    const tilePlaces=tileCandidates(anchor);
    if(tilePlaces.length){discoveries.clear();for(const p of tilePlaces)discoveries.set(p.id,p);if(/^(osm-|tile-)/.test(anchorId))discoveries.set(anchorId,anchor);}
    if(mapName){const basic=tilePlaces.find(p=>p.name.toLowerCase()===mapName.toLowerCase());if(basic){state.selected=basic.id;state.tab='Explore';state.list=false;state.expanded=true;}}
    render();
    try{
      const res=await fetch('./api/places',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:anchor.coordinates[1],lng:anchor.coordinates[0]})});
      const data=await res.json();if(!res.ok)throw new Error(data.error||'Nearby places are unavailable.');
      const candidates=(data.places||[]).map(OrientPlaces.sanitize).filter(Boolean);
      let match=candidates.filter(p=>p.name.toLowerCase()===String(mapName||anchor.name).toLowerCase()).sort((a,b)=>OrientPlaces.distance(a.coordinates,anchor.coordinates)-OrientPlaces.distance(b.coordinates,anchor.coordinates))[0];
      if(match&&OrientPlaces.distance(match.coordinates,anchor.coordinates)>200)match=null;
      if(match&&(anchor.id.startsWith('local-')||anchor.id.startsWith('tile-')))enrichments.set(anchor.id,{...match,name:anchor.name,id:anchor.id});
      const base=match||anchor;
      // Keep discovery reasons local; no saved-place list or interest profile is sent.
      const ranked=candidates.filter(p=>p.id!==match?.id||!!mapName).sort((a,b)=>{
        const ga=OrientPlaces.group(a)===OrientPlaces.group(base),gb=OrientPlaces.group(b)===OrientPlaces.group(base);
        return Number(gb)-Number(ga)||OrientPlaces.distance(a.coordinates,base.coordinates)-OrientPlaces.distance(b.coordinates,base.coordinates);
      }).slice(0,16);
      discoveries.clear();for(const p of ranked)discoveries.set(p.id,p);
      if(/^(osm-|tile-)/.test(anchor.id))discoveries.set(anchor.id,anchor.id.startsWith('tile-')?anchor:match||anchor);
      nearbyStates.set(anchorId,{loaded:true,message:candidates.length?'No new matching discoveries within this radius.':'No mapped places returned. This does not mean nothing exists here.'});
      if(mapName){if(match){discoveries.set(match.id,match);state.tab='Explore';state.filter='Everything';state.query='';$('#search').value='';state.selected=match.id;state.list=false;state.expanded=true;}else toast('That map label has no matching place record in the current data. Nearby places are available.');}
      render();
    }catch(error){const message=tilePlaces.length?'Using loaded map labels. Fuller place details are temporarily unavailable.':error.message;nearbyStates.set(anchorId,{error:true,message});if(mapName&&state.selected)nearbyStates.set(state.selected,{error:true,message});toast(message);}
    finally{discoveryBusy=false;render();}
  }
  function selectPlace(id,{expand=false}={}) {
    if(!placeById(id))return;
    if(state.collectionId&&!OrientCollections.get(state.collectionId)?.places.includes(id))state.collectionId='';
    state.exploreHome=false;state.circuitMap=false;state.loreMap=false;state.neighborId=null;state.selected=id;state.expanded=expand;state.drawerStop=expand?2:0;state.list=false;state.thread=null;state.filters=false;
    if(!['Explore','My Map'].includes(state.tab))state.tab='Explore';
    render();focusPlace(placeById(id));
  }
  function focusPlace(p) {
    if(!map||!p)return;
    const desktop=matchMedia('(min-width:760px)').matches;
    const sheet=$('#sheet');
    map.easeTo({center:p.coordinates,zoom:Math.max(map.getZoom(),14),offset:desktop?[140,0]:[0,-Math.min(sheet.offsetHeight/2,150)],duration:matchMedia('(prefers-reduced-motion:reduce)').matches?0:400});
  }
  // The heat map: places weighted by the visits you logged in the chosen range, under the labels. Off until you ask for it.
  function updateHeat(){
    if(!map||!mapLoaded)return;
    try{
      const data=OrientVisits.heatData();
      if(!map.getSource('orient-heat'))map.addSource('orient-heat',{type:'geojson',data});else map.getSource('orient-heat').setData(data);
      if(!map.getLayer('orient-heat')){
        // above every drawn shape (land, roads, buildings) but under the labels, so street names stay readable
        const layers=map.getStyle().layers;let lastShape=-1;layers.forEach((l,i)=>{if(!['symbol','heatmap','background'].includes(l.type))lastShape=i;});
        const firstLabel=layers.slice(lastShape+1).find(l=>l.type==='symbol')?.id;
        map.addLayer({id:'orient-heat',type:'heatmap',source:'orient-heat',paint:{
          'heatmap-weight':['get','n'],
          'heatmap-intensity':['interpolate',['linear'],['zoom'],10,2,17,3.2],
          'heatmap-radius':['interpolate',['linear'],['zoom'],10,30,14,72,17,140],
          'heatmap-opacity':0.9,
          'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(255,200,80,0)',0.1,'rgba(255,196,70,0.4)',0.3,'rgba(255,146,40,0.68)',0.6,'rgba(235,88,30,0.86)',1,'rgba(168,24,36,0.96)']}},firstLabel);
      }
      map.setLayoutProperty('orient-heat','visibility',store.heat===true?'visible':'none');
    }catch{}
  }
  function renderMarkers() {
    if(!map)return;
    updateHeat();
    const visible=visiblePlaces();const ids=new Set(visible.map(p=>p.id));
    for(const [id,marker] of markers)if(!ids.has(id)){marker.remove();markers.delete(id);}
    for(const p of visible){
      let marker=markers.get(p.id);
      if(!marker){const button=document.createElement('button');button.type='button';button.className='map-marker';button.addEventListener('click',e=>{e.stopPropagation();selectPlace(p.id);});marker=new maplibregl.Marker({element:button,anchor:'center'}).setLngLat(p.coordinates).addTo(map);markers.set(p.id,marker);}
      const button=marker.getElement();button.dataset.placeId=p.id;button.setAttribute('aria-label',`${p.name}${p.demo?', demo place':''}${store.visited.includes(p.id)?', visited':store.saved.includes(p.id)?', saved':''}`);button.setAttribute('aria-pressed',p.id===state.selected);
      button.classList.toggle('lit-open',state.filter==='Open now');
      button.classList.toggle('discovered',!isMarked(p.id)&&/^(osm-|tile-)/.test(p.id));
      button.innerHTML=`<span class="pin ${store.visited.includes(p.id)?'visited':store.saved.includes(p.id)?'saved':'unseen'}">${icon(store.visited.includes(p.id)?'check':p.icon)}</span><span class="pin-label">${escapeHTML(p.name)}</span>`;
    }
    OrientCircuits.syncMap(map,!!state.circuitMap&&state.tab==='My Map'&&!state.list);
    OrientJourney.syncMarkers(map,state.tab==='My Map'&&!state.list&&!state.collectionId);
    OrientNeighbors.syncMarkers(map,state.tab==='My Map'&&!state.list&&!state.collectionId,state.query);
    OrientMapLabels.refresh();
    updateFog();
  }
  function updateFog() {
    const fog=$('#fog');
    const night=state.filter==='Open now'&&['Explore','My Map'].includes(state.tab)&&!state.list;
    const enabled=night||(store.fog&&state.tab==='My Map'&&!state.list);
    fog.classList.toggle('night',night);$('.world').classList.toggle('open-map',night);
    fog.style.opacity=enabled?'.9':'0';
    OrientFog.setActive(enabled&&!night);
    if(!enabled||!map)return;
    const marked=night?visiblePlaces():[...allPlaces().filter(p=>isMarked(p.id)),...OrientNeighbors.entries().filter(n=>n.coordinates)];
    if(!marked.length){fog.style.setProperty('--fog-mask','none');return;}
    const holes=marked.map(p=>{const pt=map.project(p.coordinates);return `radial-gradient(circle ${night?125:165}px at ${Math.round(pt.x)}px ${Math.round(pt.y)}px,transparent ${night?18:36}%,rgba(0,0,0,.08) 48%,#000 100%)`;});
    fog.style.setProperty('--fog-mask',holes.join(','));fog.style.maskComposite='intersect';fog.style.webkitMaskComposite='source-in';
  }
  function renderSheet(p) {
    if(state.loreMap||state.circuitMap){$('#sheet').hidden=true;$('.world').classList.remove('has-sheet');return;}
    if(state.neighborId&&state.tab==='My Map'&&!state.list){const n=OrientNeighbors.get(state.neighborId);if(n){const sheet=$('#sheet');sheet.hidden=false;sheet.classList.add('expanded');sheet.dataset.placeId=n.id;sheet.innerHTML=OrientNeighbors.card(n);$('.world').classList.add('has-sheet');OrientDrawer.attach(sheet,state.drawerStop??0,stop=>{state.drawerStop=stop;state.expanded=stop===2;render();});return;}state.neighborId=null;}

    const sheet=$('#sheet');
    sheet.classList.toggle('expanded',state.expanded);
    if(sheet.dataset.placeId!==(p?.id||'')){sheet.scrollTop=0;sheet.dataset.placeId=p?.id||'';}
    sheet.hidden=!p||state.list||!!state.thread||!['Explore','My Map'].includes(state.tab);
    $('.world').classList.toggle('has-sheet',!sheet.hidden);
    if(sheet.hidden){sheet.innerHTML='';return;}
    const saved=store.saved.includes(p.id),visited=store.visited.includes(p.id);
    const glance=OrientWebsite.cardFacts(p,store.details?.[p.id]?.hours||'');
    sheet.innerHTML=OrientPlaces.card({...p,profileHours:glance.hours,note:p.id.startsWith('local-')?'':p.note},{saved,visited,expanded:state.expanded,discovery:discoverySection(p),glance:glance.markup,knowledge:state.expanded?OrientCalendar.section(p)+OrientCollections.section(p)+OrientCommons.section(p)+OrientPhotos.section(p):'',websiteSection:state.expanded?OrientWebsite.section(p):'',rating:store.ratings?.[p.id]||0,visits:{button:OrientVisits.button(p.id,p.name),line:OrientVisits.line(p.id),section:state.expanded?OrientVisits.section(p.id):''}});
    sheet.querySelector('.peekhead')?.insertAdjacentHTML('afterend',OrientPhotos.hero(p));
    if(state.expanded){foldSections(sheet);OrientWebsite.inspectKnown(p);}
    OrientDrawer.attach(sheet,state.drawerStop??(state.expanded?2:0),stop=>{state.drawerStop=stop;state.expanded=stop===2;render();});
  }
  const FOLDS={'place-photos':'Photos & notes','visit-history':'Your visits','place-knowledge':'People & notes','place-happening':'What’s happening','nearby-section':'Near this place','website-section':'Website & calendars'};
  function foldSections(sheet){
    state.folds=state.folds||new Set();
    for(const key of Object.keys(FOLDS)){
      const sec=sheet.querySelector('.detail > section.'+key);if(!sec)continue;
      const head=sec.querySelector('h3'),tag=sec.querySelector('.tag'),hint=sec.querySelector('.fine');
      const d=document.createElement('details');d.className='fold '+key;d.open=state.folds.has(key)||(key==='website-section'&&/Review website findings|Checking this place/.test(sec.textContent));
      const sum=document.createElement('summary');sum.innerHTML='<span>'+FOLDS[key]+'</span><small></small>'+icon('chevron-down');
      sum.querySelector('small').textContent=key==='visit-history'?(hint?.textContent.startsWith('Tap')?'':(hint?.textContent||'').split(' · ')[0]):tag?tag.textContent.toLowerCase():'';
      (head.closest('.nearby-heading')||head).remove();tag?.remove();
      d.append(sum);while(sec.firstChild)d.append(sec.firstChild);sec.replaceWith(d);
      d.addEventListener('toggle',()=>{d.open?state.folds.add(key):state.folds.delete(key);});
    }
  }
  function row(p){return `<button class="row" data-place="${escapeHTML(p.id)}"><span class="tile">${icon(p.icon)}</span><span class="row-copy"><strong>${escapeHTML(p.name)}</strong><small>${state.tab==='Explore'?distanceMiles(p).toFixed(1)+' mi · ':''}${escapeHTML(p.kind)}${p.specials?.length?' · '+p.specials.length+' specials':''}${store.ratings?.[p.id]?` · ★ ${store.ratings[p.id]}/5`:''} · ${store.visited.includes(p.id)?OrientVisits.rowLabel(p.id):store.saved.includes(p.id)?'Saved':p.demo?'Demo place':'Not yet saved'}</small></span>${icon('chevron-right')}</button>`;}
  const exploreOverview=()=>state.tab==='Explore'&&state.exploreHome&&!state.selected&&!state.query&&!state.list&&state.filter==='Everything'&&!activeFilters().length;
  function renderPanel(visible) {
    if(state.tab==='My Map')visible=visible.filter(p=>isMarked(p.id)||collected(p.id));
    const panel=$('#panel');
    if(exploreOverview()){panel.hidden=false;panel.classList.add('briefing-drawer');panel.classList.toggle('briefing-expanded',state.briefingExpanded);OrientToday.render(panel,'');panel.insertAdjacentHTML('afterbegin','<div class="explore-start-actions"><button class="button" data-action="explore-map">Browse the map</button><button class="button" data-action="explore-list">Explore as a list</button><button class="button start-add" data-action="add" aria-label="Add a place">+</button></div>');if(!visible.length&&store.home)panel.insertAdjacentHTML('beforeend','<button class="button primary full" data-action="discover-home">Look around the city center</button>');const body=document.createElement('div');body.id='briefing-body';body.className='briefing-body';body.hidden=!state.briefingExpanded;body.innerHTML=panel.innerHTML;panel.replaceChildren(body);panel.insertAdjacentHTML('afterbegin','<button class="briefing-handle" aria-expanded="'+state.briefingExpanded+'" aria-controls="briefing-body" aria-label="'+(state.briefingExpanded?'Minimize daily briefing':'Expand daily briefing')+'"><span class="briefing-grip"></span><span class="briefing-title">'+icon('sun')+'<span><strong>Today around '+escapeHTML(OrientAreas.area()?.name||store.home?.name||'you')+'</strong><small>Specials, service hours & a little direction</small></span>'+icon(state.briefingExpanded?'chevron-down':'chevron-up')+'</span></button>');OrientBriefing.attach(panel,state.briefingExpanded,expanded=>{state.briefingExpanded=expanded;render();});return;}panel.classList.remove('briefing-drawer','briefing-expanded');panel.style.removeProperty('height');
    panel.hidden=(state.filter==='Open now'&&!state.list&&['Explore','My Map'].includes(state.tab))||!!state.circuitMap||!!state.loreMap||!!state.neighborId||!state.list&&!state.thread&&['Explore','My Map'].includes(state.tab)&&visible.length>0;
    if(panel.hidden){panel.innerHTML='';return;}
    if(state.tab==='Today'){
      OrientToday.render(panel,state.query);
    } else if(state.tab==='Calendar') {
      OrientCalendar.render(panel,state.query);
    } else if(state.tab==='Community') {
      if(state.thread){
        const thread=threads.find(t=>t.id===state.thread);
        if(!thread){state.thread=null;renderPanel(visible);return;}
        const drafts=store.drafts[thread.id]||[];
        panel.innerHTML=`<button class="back" data-action="community-back">${icon('arrow-left')}Community</button><div class="kicker">${escapeHTML(thread.group)} · Demo thread</div><h2>${escapeHTML(thread.title)}</h2>${thread.posts.map(p=>`<div class="thread-reply"><strong>${escapeHTML(p.author)}</strong> <small>Sample post</small><p>${escapeHTML(p.text)}</p></div>`).join('')}${drafts.map(d=>`<div class="thread-reply"><strong>You</strong> <small>Private draft · Not published</small><p>${escapeHTML(d.text)}</p></div>`).join('')}<form id="draft-form" class="draft-form"><label for="draft">Try a reply</label><textarea id="draft" required maxlength="2000" rows="3" placeholder="Your reply stays in this browser…"></textarea><button type="submit" class="button primary">Save private draft</button></form><p class="fine">Prototype only. No replies are sent or shared.</p>`;
        $('#draft-form').addEventListener('submit',e=>{e.preventDefault();const text=$('#draft').value.trim();if(!text)return;store.drafts[thread.id]=[...(store.drafts[thread.id]||[]),{text,date:new Date().toISOString()}].slice(-100);save();render();toast('Draft saved privately. Nothing was published.');});
      }else panel.innerHTML=`<div class="kicker">Conversations rooted in places</div><h2>Community</h2><p class="sub">People gathering around a shared place.</p>${(store.showDemo?threads:[]).filter(t=>!state.query||`${t.group} ${t.title}`.toLowerCase().includes(state.query)).map(t=>`<button class="row" data-thread="${t.id}"><span class="tile">${icon(t.icon)}</span><span class="row-copy"><strong>${t.group}</strong><small>${t.title}<br>${t.posts.length} sample posts</small></span>${icon('chevron-right')}</button>`).join('')||empty('No conversations here yet','Turn on demo places to explore sample threads.')}<p class="fine">Demo community · Replies are local drafts.</p>`;
    } else {
      panel.innerHTML=`<div class="explore-list-heading">${state.tab==='Explore'?'<button class="back" data-action="back-today">← Back to today</button>':''}<div class="kicker">${state.tab==='My Map'?'Private · Deliberately marked':'Places around '+escapeHTML(OrientAreas.area()?.name||store.home?.name||'your chosen area')}</div></div><h2>${state.tab==='My Map'?(state.collectionId?escapeHTML(OrientCollections.get(state.collectionId)?.name||'Your collection'):'Your city, becoming familiar.'):'Explore as a list'}</h2>${state.tab==='My Map'?`<p class="sub">${state.collectionId?visible.length+' places · Private collection':store.saved.length+' saved · '+store.visited.length+' visited · '+OrientNeighbors.entries().length+' neighbors'}</p>`:''}${state.tab==='Explore'?`<p class="fine">${visible.length} places · ${state.sort==='Nearby first'?'Nearest first':'By name'} · From ${escapeHTML(state.originLabel||store.home?.name||'your chosen area')}</p>${exploreControls(true)}${filterChips()}`:''}${state.tab==='My Map'?OrientCollections.filter(state.collectionId)+(state.collectionId?'<p class="fine">'+escapeHTML(OrientCollections.get(state.collectionId)?.description||'Places gathered around an idea.')+'</p><button class="button" data-collection="open" data-id="'+escapeHTML(state.collectionId)+'">Open collection</button>':OrientCollections.summary()+OrientPhotos.entry()+OrientCircuits.summary()+OrientJourney.summary()+OrientVisits.summary()+OrientNeighbors.list(state.query)):''}${visible.map(row).join('')||(state.tab==='My Map'&&!state.collectionId&&OrientNeighbors.entries().length?'':empty(state.query?'Nothing found':state.tab==='My Map'?'Your map starts with one place.':'No places to show',state.tab==='Explore'?'Try widening the distance or clearing a filter.':state.query?'Try another name, category, or filter.':'Save a place from Explore, or add somewhere you already know.'))}${state.tab==='Explore'&&store.home&&!visible.length?'<button class="button primary full" data-action="discover-home">Look around the city center</button>':''}<button class="button full" data-action="add">${icon('plus')}Add your own place</button>`;
    }
  }
  function empty(title,copy){return `<div class="empty">${icon('compass')}<h3>${title}</h3><p>${copy}</p></div>`;}
  function render(){
    if(state.collectionId&&!OrientCollections.get(state.collectionId))state.collectionId='';
    refreshCategoryOptions();
    if(window.OrientHome)OrientHome.refresh();OrientAreas.refresh();
    if(window.OrientGidgit)OrientGidgit.refresh();
    const visible=visiblePlaces();
    if(state.selected&&!visible.some(p=>p.id===state.selected))state.selected=null;
    const p=placeById(state.selected);
    document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tab===state.tab));
    $('#context').textContent=state.tab==='My Map'?`${store.saved.length} SAVED · ${store.visited.length} VISITED · PRIVATE`:exploreOverview()?(OrientAreas.area()?.name||store.home?.name||'YOUR CITY')+' · TODAY':state.tab==='Calendar'?(OrientAreas.area()?.name||store.home?.name||'YOUR CITY')+' · CALENDAR':state.tab==='Community'?'TOLEDO · COMMUNITY':state.filter==='Everything'?(OrientAreas.area()?.name||store.home?.name||'YOUR CITY')+' · DISCOVER':`${(OrientAreas.area()?.name||store.home?.name||"YOUR CITY").toUpperCase()} · ${state.filter.toUpperCase()}`;
    const night=state.filter==='Open now';$('#open-map-legend').hidden=state.list||!night||!['Explore','My Map'].includes(state.tab);if(night){const unknown=allPlaces().filter(p=>opening(p).state==='unknown').length;$('#open-map-legend').textContent=visible.length+' open by listed hours · '+unknown+' with unknown hours · '+OrientHome.timeZone()+'. Holiday changes may differ.';}
    $('#journey-tool').hidden=state.tab!=='My Map';
    $('#collections-tool').hidden=state.tab!=='My Map';
    const collection=state.tab==='My Map'?OrientCollections.get(state.collectionId):null;const banner=$('#collection-map-banner');banner.hidden=!collection||state.list;banner.innerHTML=collection?'<strong>'+escapeHTML(collection.name)+'</strong><button class="button" data-collection="open" data-id="'+escapeHTML(collection.id)+'">Collection</button><button class="button" data-collection="clear">All places</button>':'';
    $('#circuits-tool').hidden=state.tab!=='My Map';
    $('#tools').hidden=exploreOverview()||!['Explore','My Map'].includes(state.tab)||state.list;
    $('#filters').hidden=!state.filters;
    document.querySelector('[data-action="filters"]').setAttribute('aria-expanded',state.filters);
    $('#filter-dot').hidden=state.filter==='Everything'&&!(state.tab==='Explore'&&activeFilters().length);
    $('#filter-options').innerHTML=['Everything','Specials','Open now','Free events'].map(f=>`<button data-filter="${f}" aria-pressed="${state.filter===f}">${f}</button>`).join('');
    if(state.tab==='Explore')$('#filter-options').innerHTML+=exploreControls();
    $('#filters > .fine').hidden=true;
    renderSheet(p);renderPanel(visible);renderMarkers();icons();
    $('#fog-toggle').checked=store.fog;$('#demo-toggle').checked=store.showDemo;
    requestAnimationFrame(()=>$('.world').style.setProperty('--sheet-height',`${$('#sheet').offsetHeight+8}px`));
  }
  let editId=null, locationReady=false, lookupResults=[], lookupController=null, siteRead=null, siteController=null;
  function locationStatus(message){$('#lookup-status').textContent=message;}
  function cancelLookup(){lookupController?.abort();lookupController=null;const b=document.querySelector('[data-action="lookup"]');b.disabled=false;b.innerHTML=icon('search')+'Find address';icons();}
  function addPlace(existing=null){
    cancelLookup();
    refreshCategoryOptions();const form=$('#add-form');form.reset();form.elements.kind.value='Other';editId=existing?.id||null;locationReady=!!existing;lookupResults=[];
    $('#lookup-results').innerHTML='';$('#coordinate-details').open=false;resetSite();$('#site-start').hidden=!!existing;
    $('#add-title').textContent=existing?'Edit your place':'Put a place on your map';
    $('#add-choices').hidden=!!existing;$('#add-fields').hidden=!existing;$('#add-fields').disabled=!existing;document.querySelector('[data-action="add-choices"]').hidden=!!existing;
    form.querySelector('[type=submit]').textContent=existing?'Save changes':'Add to My Map';
    if(existing){for(const key of ['name','kind','address','note'])form.elements[key].value=(key==='note'?store.details?.[existing.id]?.note??existing.note:existing[key])||'';form.elements.lat.value=existing.coordinates[1];form.elements.lng.value=existing.coordinates[0];}
    locationStatus(existing?'Current pin kept. Look up an address to move it.':'Choose a match before saving.');
    $('#add-dialog').showModal();
  }
  // ── Start a place from a website address ──────────────────────────────────────
  // The address is read only after the button is pressed. It fills in what the page publishes (name, address, category, phone, hours,
  // social links, map location) for review; the website address itself is kept with the place whether or not it was read.
  const siteStatus=message=>{$('#site-status').textContent=message;};
  function kindFromTypes(types){const t=(types||[]).join(' ');const label=/Library/.test(t)?'Library':/Restaurant|FoodEstablishment|Cafe|BarOrPub|Bakery|Brewery|Winery/.test(t)?'Food & drink':/Museum/.test(t)?'Museum':/Store|Shop/.test(t)?'Shop':/Church|PlaceOfWorship/.test(t)?'Place of worship':'';return label?canonicalCategory(label):'';}
  function resetSite(){siteController?.abort();siteController=null;siteRead=null;const found=$('#site-found');if(found)found.innerHTML='';const s=$('#site-status');if(s)s.textContent='';const b=document.querySelector('[data-action="read-site"]');if(b){b.disabled=false;b.innerHTML=icon('search')+'Read website';icons();}}
  async function readSite(){
    const form=$('#add-form'),url=OrientWebsite.normalize(form.elements.website.value);
    if(!url){siteStatus('Enter a valid website address (http or https).');return;}
    siteController?.abort();siteController=new AbortController();const mine=siteController;
    const b=document.querySelector('[data-action="read-site"]');b.disabled=true;b.textContent='Reading website…';
    siteStatus('Reading public pages. Only the website address is sent.');$('#site-found').innerHTML='';siteRead=null;
    try{
      const result=await OrientWebsite.read(url,mine.signal);if(mine!==siteController)return;
      siteRead={url,result};applySite(result);
    }catch(e){if(e.name!=='AbortError'&&mine===siteController)siteStatus(e.message+' You can still add the place; its website address will be kept.');}
    finally{if(mine===siteController){b.disabled=false;b.innerHTML=icon('search')+'Read website';icons();}}
  }
  function applySite(r){
    const form=$('#add-form'),place=r.place||{},said=[];
    const name=place.names?.[0]?.value;
    if(name&&!form.elements.name.value.trim()){form.elements.name.value=name.slice(0,100);said.push('name');}
    const addr=(r.facts||[]).find(f=>f.key==='address');
    if(addr&&!form.elements.address.value.trim()){form.elements.address.value=addr.value.slice(0,250);locationReady=false;lookupResults=[];$('#lookup-results').innerHTML='';said.push('address');locationStatus('Address filled from the website. Press Find address to choose the matching location.');}
    const kind=kindFromTypes(place.types);
    if(kind&&(!form.elements.kind.value.trim()||form.elements.kind.value==='Other')){form.elements.kind.value=kind;said.push('category');}
    const labels={phone:'Phone',hours:'Published hours',address:'Published address'};
    const rows=(r.facts||[]).map((f,i)=>({f,i})).filter(({f})=>['phone','hours','social','address'].includes(f.key)).map(({f,i})=>`<label class="website-choice"><input type="checkbox" data-site-fact="${i}" checked><span><strong>${escapeHTML(f.key==='social'?(OrientSocial.parse(f.value)?.label||'Social link'):labels[f.key])}</strong><span>${escapeHTML(f.value)}</span><small>${escapeHTML(f.method)}</small></span></label>`).join('');
    const nEvents=(r.events||[]).length,nCals=(r.calendars||[]).length;
    $('#site-found').innerHTML=
      `<p class="fine">${said.length?'Filled in from the website: '+said.join(', ')+'. ':''}${name?'':'No name was found on the page, so enter one. '}${addr||place.coordinates?'':'No address was found on the page: enter one below, then press Find address. '}</p>`+
      (place.coordinates?'<button type="button" class="button full" data-action="site-pin">Use the map location this website publishes</button>':'')+
      (rows?'<p class="fine">Tick what to keep with this place. Nothing is saved until you press Add to My Map.</p>'+rows:'<p class="fine">No phone number, hours or social links were found.</p>')+
      ((nEvents||nCals)?`<p class="fine">${nEvents?nEvents+' upcoming event'+(nEvents===1?'':'s'):'A calendar feed'} found. After adding the place, use Read a website on its card to import them.</p>`:'');
    siteStatus(`Read ${(r.readPages||[]).length||1} page${(r.readPages||[]).length===1?'':'s'}. Check the details, then choose a location.`);
  }
  function attachSite(id,fields){
    const typed=OrientWebsite.normalize(String(fields.get('website')||''));if(!typed)return;
    const chosen=siteRead?[...document.querySelectorAll('#site-found [data-site-fact]:checked')].map(b=>siteRead.result.facts[+b.dataset.siteFact]).filter(Boolean):[];
    OrientWebsite.attach(id,typed,chosen,siteRead?.result.retrievedAt||'');
  }
  async function findAddress(){
    const query=$('#add-form').elements.address.value.trim();
    if(query.length<3){locationStatus('Enter an address or business name, including the city.');return;}
    cancelLookup();lookupController=new AbortController();const controller=lookupController;
    const b=document.querySelector('[data-action="lookup"]');b.disabled=true;b.textContent='Finding address…';
    locationReady=false;lookupResults=[];$('#lookup-results').innerHTML='';locationStatus('Looking for matching locations…');
    try{
      const response=await fetch('./api/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,center:state.origin}),signal:controller.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Address search failed.');
      if(controller!==lookupController)return;
      lookupResults=Array.isArray(data.results)?data.results:[];
      locationStatus(data.message||(lookupResults.length?'Choose the address that matches your place.':'No matches found. Try the street address and city, or use the map center.'));
      $('#lookup-results').innerHTML=lookupResults.map((p,i)=>`<button type="button" class="lookup-result" data-location="${i}"><span>${icon('map-pin')}</span><span><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.address)}</small>${p.accuracy?`<small class="match-accuracy">${escapeHTML(p.accuracy)}</small>`:''}</span>${icon('chevron-right')}</button>`).join('');
      icons();
    }catch(error){if(error.name!=='AbortError'&&controller===lookupController)locationStatus(error.message||'Address lookup is unavailable. Try again.');}
    finally{if(controller===lookupController){lookupController=null;b.disabled=false;b.innerHTML=icon('search')+'Find address';icons();}}
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button,[data-action]');if(!b)return;
    if(b.dataset.tab){state.collectionId='';if(['Explore','Today'].includes(b.dataset.tab)){state.exploreHome=true;state.briefingExpanded=false;state.selected=null;state.query='';$('#search').value='';state.filter='Everything';Object.assign(state,filterDefaults);}state.circuitMap=false;state.loreMap=false;state.neighborId=null;state.tab=b.dataset.tab==='Today'?'Explore':b.dataset.tab;state.drawerStop=0;state.list=false;state.expanded=false;state.thread=null;state.filters=false;render();return;}
    if(b.dataset.place){selectPlace(b.dataset.place,{expand:b.dataset.expand==='true'});return;}
    if(b.dataset.thread){state.thread=b.dataset.thread;state.tab='Community';render();return;}
    if(b.dataset.clearFilter){state[b.dataset.clearFilter]=filterDefaults[b.dataset.clearFilter];render();return;}
    if(b.dataset.filter){state.filter=b.dataset.filter;if(state.filter==='Open now'){state.circuitMap=false;state.loreMap=false;state.neighborId=null;}state.filters=false;render();return;}
    if(b.dataset.location!==undefined){
      const result=lookupResults[Number(b.dataset.location)];if(!result)return;
      const form=$('#add-form');form.elements.lat.value=result.coordinates[1];form.elements.lng.value=result.coordinates[0];form.elements.address.value=result.address.slice(0,250);
      if(!form.elements.name.value.trim())form.elements.name.value=result.name.slice(0,100);
      locationReady=true;$('#lookup-results').innerHTML='';locationStatus(`Location selected: ${result.address}${result.accuracy?' — '+result.accuracy:''}`);
      map?.easeTo({center:result.coordinates,zoom:16,duration:300});return;
    }
    switch(b.dataset.action){
      case 'clear-filters':Object.assign(state,filterDefaults);state.filter='Everything';render();break;
      case 'discover-home':{const area=OrientAreas.area();if(area){state.list=true;loadNearby({id:'home-area',name:area.name,kind:'City',coordinates:area.coordinates});}}break;
      case 'filter-center':if(map){const c=map.getCenter();state.origin=[c.lng,c.lat];state.originLabel='chosen map center';render();}else toast('The map is still loading.');break;
      case 'filters':state.filters=!state.filters;render();break;
      case 'home':if(store.home)OrientAreas.choose(store.home);else OrientHome.open();break;
      case 'north':map?.easeTo({bearing:0,pitch:0,duration:300});break;
      case 'explore-map':state.exploreHome=false;state.selected=null;state.list=false;render();break;
      case 'back-today':state.tab='Explore';state.exploreHome=true;state.briefingExpanded=true;state.selected=null;state.query='';$('#search').value='';state.list=false;state.filters=false;state.filter='Everything';state.circuitMap=false;state.loreMap=false;state.neighborId=null;state.thread=null;Object.assign(state,filterDefaults);render();$('#panel .briefing-handle')?.focus({preventScroll:true});break;
      case 'explore-list':state.exploreHome=false;state.selected=null;state.list=true;render();break;
      case 'list':state.exploreHome=false;state.circuitMap=false;state.loreMap=false;state.neighborId=null;state.list=!state.list;state.drawerStop=0;state.expanded=false;render();break;
      case 'expand':if(OrientDrawer.mobile()){state.drawerStop=(state.drawerStop??0)===2?1:2;state.expanded=state.drawerStop===2;}else state.expanded=!state.expanded;render();break;
      case 'clear-rating':if(state.selected){delete store.ratings?.[state.selected];save();render();}break;
      case 'save':if(state.selected)toggleMark('saved',state.selected);break;
      case 'visit':case 'log-visit':if(state.selected)OrientVisits.tap(state.selected);break;
      case 'visit-undo':OrientVisits.undo();break;
      case 'visit-remove':if(state.selected)OrientVisits.removeAt(state.selected,Number(b.dataset.visitIndex));break;
      case 'visit-add-date':{const input=document.querySelector('.visit-history [name=visit-date]');const msg=state.selected?OrientVisits.addOn(state.selected,input?.value):'';if(msg){const s=document.querySelector('#visit-add-status');if(s)s.textContent=msg;}break;}
      case 'visit-clear':if(state.selected&&confirm('Clear every visit logged for this place? The place stays on your map.'))OrientVisits.clear(state.selected);break;
      case 'visits-window':OrientVisits.setWindow(b.dataset.days);break;
      case 'visits-heat':OrientVisits.toggleHeat();break;
      case 'demo-directions':toast('This place is fictional. Add a real place to try directions.');break;
      case 'nearby':{const p=placeById(state.selected);if(p)loadNearby(p);break;}
      case 'discussion':state.thread=threads.find(t=>t.placeId===state.selected)?.id||null;state.tab='Community';render();break;
      case 'community-back':state.thread=null;render();break;
      case 'add':addPlace();break;
      case 'edit-category':editCategory();break;
      case 'close-category':$('#category-dialog').close();break;
      case 'default-category':delete store.details?.[state.selected]?.category;save();$('#category-dialog').close();render();break;
      case 'edit-place':addPlace(placeById(state.selected));break;
      case 'lookup':findAddress();break;
      case 'read-site':readSite();break;
      case 'site-pin':{const c=siteRead?.result?.place?.coordinates;if(!c)break;cancelLookup();const form=$('#add-form');form.elements.lat.value=c[1];form.elements.lng.value=c[0];locationReady=true;lookupResults=[];$('#lookup-results').innerHTML='';locationStatus('Location selected: the point this website publishes (its own map data, not verified).');map?.easeTo({center:c,zoom:16,duration:300});break;}
      case 'map-center':{cancelLookup();const center=map?.getCenter();if(!center){locationStatus('Map unavailable. Enter coordinates instead.');break;}const form=$('#add-form');form.elements.lat.value=center.lat.toFixed(6);form.elements.lng.value=center.lng.toFixed(6);locationReady=true;$('#lookup-results').innerHTML='';locationStatus('Using the current map center. No GPS location was requested.');break;}
      case 'add-name':$('#add-choices').hidden=true;$('#add-fields').hidden=false;$('#add-fields').disabled=false;$('#add-form').elements.name.focus();break;
      case 'add-choices':cancelLookup();resetSite();$('#add-fields').hidden=true;$('#add-fields').disabled=true;$('#add-choices').hidden=false;document.querySelector('[data-action="add-name"]').focus();break;
      case 'close-add':cancelLookup();$('#add-dialog').close();break;
      case 'settings':$('#settings-dialog').showModal();OrientSync.render();break;
      case 'close-settings':$('#settings-dialog').close();break;
      case 'delete-place':if(confirm('Remove this place, its calendar entries, personal details, and saved/visited marks from this browser?')){store.collections=(store.collections||[]).map(c=>({...c,places:c.places.filter(id=>id!==state.selected)}));store.custom=store.custom.filter(p=>p.id!==state.selected);store.events=(store.events||[]).filter(e=>e.placeId!==state.selected);delete store.photos?.[state.selected];delete store.ratings?.[state.selected];delete store.details?.[state.selected];delete store.web?.profiles?.[state.selected];delete store.web?.urls?.[state.selected];if(store.web)store.web.sources=store.web.sources.filter(s=>s.placeId!==state.selected);store.saved=store.saved.filter(id=>id!==state.selected);store.visited=store.visited.filter(id=>id!==state.selected);delete store.visitLog?.[state.selected];save();render();}break;
      case 'reset':if(confirm('Reset all saved places, visits, personal details, calendar entries, and drafts in this browser? Export first if you want to keep them.')){store={version:1,home:store.home,useCatalog:store.useCatalog,custom:[],osm:[],ratings:{},saved:[],visited:[],visitLog:{},heat:false,visitDays:14,drafts:{},details:{},events:[],showDemo:true,fog:true};discoveries.clear();enrichments.clear();nearbyStates.clear();state.neighborId=null;save();state.tab='Explore';state.query='';$('#search').value='';state.filter='Everything';state.list=false;state.drawerStop=0;state.expanded=false;state.thread=null;render();$('#settings-dialog').close();toast('Your browser’s map has been reset.');}break;
      case 'export':{const blob=new Blob([JSON.stringify(store,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`orient-my-map-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;}
    }
  });
  document.addEventListener('change',e=>{if(!e.target.matches('[data-explore-filter]'))return;const key=e.target.dataset.exploreFilter;if(!Object.hasOwn(filterDefaults,key))return;state[key]=e.target.value;render();[...document.querySelectorAll('[data-explore-filter="'+key+'"]')].find(el=>el.getClientRects().length)?.focus({preventScroll:true});});
  document.addEventListener('change',e=>{if(!e.target.matches('[name=place-rating]'))return;const id=state.selected,value=Number(e.target.value);if(!id||!Number.isInteger(value)||value<1||value>5)return;privatePlaceAPI.keep(id);store.ratings||={};store.ratings[id]=value;save();render();document.querySelector('[name=place-rating][value="'+value+'"]')?.focus({preventScroll:true});});
  $('#search').addEventListener('input',e=>{state.query=e.target.value.trim().toLowerCase();state.selected=null;if(state.tab==='Explore'){state.exploreHome=!state.query;state.briefingExpanded=false;}state.list=!!state.query;render();});
  $('#add-form').elements.address.addEventListener('input',()=>{cancelLookup();locationReady=false;lookupResults=[];$('#lookup-results').innerHTML='';locationStatus('Address changed. Press Find address and choose a match.');});
  $('#add-form').elements.address.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();findAddress();}});
  $('#add-form').elements.website.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();readSite();}});
  $('#add-form').elements.website.addEventListener('input',()=>{siteController?.abort();siteController=null;siteRead=null;$('#site-found').innerHTML='';siteStatus('');const b=document.querySelector('[data-action="read-site"]');b.disabled=false;b.innerHTML=icon('search')+'Read website';icons();});
  for(const key of ['lat','lng'])$('#add-form').elements[key].addEventListener('input',()=>{cancelLookup();const form=$('#add-form');locationReady=!!form.elements.lat.value.trim()&&!!form.elements.lng.value.trim();locationStatus('Using manually entered coordinates.');});
  $('#add-dialog').addEventListener('cancel',cancelLookup);
  $('#add-form').addEventListener('submit',e=>{
    e.preventDefault();const fields=new FormData(e.target);const name=String(fields.get('name')).trim();const lat=Number(fields.get('lat')),lng=Number(fields.get('lng'));
    const rawSite=String(fields.get('website')||'').trim();if(!editId&&rawSite&&!OrientWebsite.normalize(rawSite)){siteStatus('That website address is not valid. Correct it or clear the box.');$('#site-status').scrollIntoView({block:'nearest'});return;}
    if(!locationReady){locationStatus('Find an address and choose a match, or explicitly use the map center or coordinates.');$('#lookup-status').scrollIntoView({block:'nearest'});return;}
    if(!name||!String(fields.get('lat')).trim()||!String(fields.get('lng')).trim()||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180){locationStatus('Enter a name and a valid location.');return;}
    const editing=!!editId;
    const kind=canonicalCategory(fields.get('kind'))||'Other';const p={id:editId||`local-${crypto.randomUUID?.()||Date.now().toString(36)}`,name:name.slice(0,100),kind,icon:categoryIcon(kind),coordinates:[lng,lat],address:String(fields.get('address')).slice(0,250),note:String(fields.get('note')).slice(0,800),demo:false};
    if(editing&&store.details?.[editId]){store.details[editId].note=p.note;delete store.details[editId].category;}
    if(editing){store.custom=store.custom.map(old=>old.id===editId?p:old);markers.get(editId)?.setLngLat(p.coordinates);}else{store.custom.push(p);store.saved.push(p.id);attachSite(p.id,fields);}
    cancelLookup();save();$('#add-dialog').close();state.tab='My Map';state.query='';$('#search').value='';state.filter='Everything';selectPlace(p.id,{expand:true});toast(editing?'Place updated. Your saved and visited marks are kept.':'A new place on your map. Saved only in this browser.');
  });
  $('#fog-toggle').addEventListener('change',e=>{store.fog=e.target.checked;save();render();});
  $('#demo-toggle').addEventListener('change',e=>{store.showDemo=e.target.checked;save();render();});
  $('#import-file').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{if(file.size>3*1024*1024)throw new Error('Choose an export smaller than 3 MB.');const rawImport=JSON.parse(await file.text());if(OrientCatalog.needed(rawImport))await OrientCatalog.load();const imported=cleanData(rawImport);if(!confirm('Replace this browser’s map with the imported map?'))return;store=imported;state.origin=store.home?.coordinates||[0,20];state.originLabel=store.home?.name||'your chosen area';if(store.home)map?.jumpTo({center:store.home.coordinates,zoom:12});save();state.selected=null;state.neighborId=null;state.thread=null;state.query='';$('#search').value='';state.filter='Everything';state.tab='My Map';state.list=true;render();$('#settings-dialog').close();toast('Your map has been imported.');}catch(error){toast(error instanceof SyntaxError?'That file is not valid JSON.':error.message);}finally{e.target.value='';}
  });
  new ResizeObserver(()=>{map?.resize();updateFog();$('.world').style.setProperty('--sheet-height',`${$('#sheet').offsetHeight+8}px`);}).observe($('.world'));
  new ResizeObserver(()=>{$('.world').style.setProperty('--sheet-height',`${$('#sheet').offsetHeight+8}px`);}).observe($('#sheet'));
  const privatePlaceAPI={store:()=>store,places:allPlaces,showDemo:()=>store.showDemo,save,render,select:id=>selectPlace(id,{expand:true}),keep:id=>{const p=placeById(id);if(!p)return;if(/^(osm-|tile-)/.test(id)&&!store.osm.some(x=>x.id===id))store.osm.push(OrientPlaces.sanitize(p));if(!store.saved.includes(id))store.saved.push(id);}};
  setInterval(()=>{if(document.visibilityState==='visible'&&state.filter==='Open now')render();},30000);
  OrientNeighbors.init({store:()=>store,save,map:()=>map,show:id=>{const n=OrientNeighbors.get(id);if(!n)return;state.circuitMap=false;state.loreMap=false;state.drawerStop=0;state.neighborId=id;state.tab='My Map';state.list=false;state.expanded=true;state.filters=false;render();if(n.coordinates)focusPlace(n);},back:()=>{state.neighborId=null;state.tab='My Map';state.list=true;render();}});
  OrientHome.init({...privatePlaceAPI,preview:coordinates=>map?.easeTo({center:coordinates,zoom:11,duration:400}),set:home=>{const previous=store.home;store.home=home;if(!save()){store.home=previous;return false;}state.origin=[...home.coordinates];state.originLabel=home.name;state.selected=null;state.exploreHome=true;state.briefingExpanded=false;state.query='';$('#search').value='';state.tab='Explore';state.list=false;state.expanded=false;state.circuitMap=false;state.loreMap=false;state.neighborId=null;Object.assign(state,filterDefaults);render();map?.easeTo({center:home.coordinates,zoom:12,duration:400});$('#settings-dialog').close();toast('Your home area is '+home.name+'.');return true;}});
  OrientAreas.init({home:()=>store.home,toast,view:()=>map?{center:map.getCenter().toArray(),zoom:map.getZoom()}:null,choose:(area,view)=>{state.origin=[...area.coordinates];state.originLabel=area.name;state.tab='Explore';state.selected=null;state.exploreHome=true;state.briefingExpanded=false;state.query='';$('#search').value='';state.list=false;state.filter='Everything';state.filters=false;state.expanded=false;state.circuitMap=false;state.loreMap=false;state.neighborId=null;state.thread=null;Object.assign(state,filterDefaults);render();map?.jumpTo({center:view?.center||area.coordinates,zoom:view?.zoom||12});OrientWeather.refresh();}});
  OrientCollections.init({...privatePlaceAPI,show:(id,list)=>{state.collectionId=id;state.tab='My Map';state.list=list;state.selected=null;state.query='';$('#search').value='';state.filter='Everything';state.circuitMap=false;state.loreMap=false;state.neighborId=null;state.thread=null;Object.assign(state,filterDefaults);render();const points=OrientCollections.get(id)?.places.map(placeById).filter(Boolean).map(p=>p.coordinates)||[];if(!list&&map&&points.length){const bounds=new maplibregl.LngLatBounds();points.forEach(p=>bounds.extend(p));map.fitBounds(bounds,{padding:80,maxZoom:15,duration:400});}}});
  OrientCommons.init({...privatePlaceAPI,toast});
  OrientCalendar.init(privatePlaceAPI);
  OrientPhotos.init({...privatePlaceAPI,toast,startMemory:()=>{cancelLookup();resetSite();$('#add-dialog').close();},mapCenter:()=>{if(!mapLoaded||!map)return null;const p=map.getCenter();return [p.lng,p.lat];},select:id=>{state.query='';$('#search').value='';selectPlace(id,{expand:true});}});
  OrientWebsite.init({...privatePlaceAPI,toast});
  OrientGidgit.init({...privatePlaceAPI,toast,selected:()=>state.selected,origin:()=>state.origin,show:id=>{state.filter='Everything';Object.assign(state,filterDefaults);state.query='';$('#search').value='';state.tab='My Map';state.list=false;selectPlace(id,{expand:true});}});
  OrientSync.init({get:()=>JSON.parse(JSON.stringify(store)),apply:async raw=>{if(OrientCatalog.needed(raw))await OrientCatalog.load();const previous=store.home;store=cleanData(raw);if(JSON.stringify(previous)!==JSON.stringify(store.home)){state.origin=store.home?.coordinates||[0,20];state.originLabel=store.home?.name||'your chosen area';if(store.home)map?.jumpTo({center:store.home.coordinates,zoom:12});}try{localStorage.setItem(KEY,JSON.stringify(store));}catch{}render();}});
  OrientTakeout.init({store:()=>store,places:allPlaces,origin:()=>state.origin,icon:categoryIcon,save,render,keepOsm,addVisit:(id,day)=>OrientVisits.add(id,day),visitDays:id=>OrientVisits.entries(id)});
  OrientWeather.init({origin:()=>state.origin,label:()=>state.originLabel||store.home?.name||''});
  OrientMapLabels.init({map:()=>map,markers:()=>markers,selected:()=>state.selected,priority:id=>(id===state.selected?1000:0)+(store.visited.includes(id)?120:store.saved.includes(id)?100:isMarked(id)?50:10)+(store.ratings?.[id]||0),info:id=>{const p=placeById(id);if(!p)return null;const o=opening(p);return {name:p.name,kind:p.kind,address:p.address||'',status:/^(Open|Closed)/.test(o?.label||'')?o.label:'',visits:OrientVisits.line(id),saved:store.saved.includes(id)};}});
  OrientVisits.init({store:()=>store,places:allPlaces,save,render,keepOsm,hasHeatLayer:()=>!!map?.getLayer?.('orient-heat')});
  OrientJourney.init({...privatePlaceAPI,toast,showMap:coordinates=>{state.filter='Everything';state.circuitMap=false;state.loreMap=true;state.neighborId=null;state.tab='My Map';state.list=false;state.query='';$('#search').value='';render();map?.easeTo({center:coordinates,zoom:15,duration:400});}});
  OrientCircuits.init({...privatePlaceAPI,back:()=>{state.circuitMap=false;state.loreMap=false;state.tab='My Map';state.list=true;render();},showMap:coordinates=>{state.circuitMap=true;state.loreMap=false;state.neighborId=null;state.tab='My Map';state.list=false;state.query='';document.querySelector('#search').value='';render();if(map&&coordinates.length){const bounds=new maplibregl.LngLatBounds();coordinates.forEach(c=>bounds.extend(c));map.fitBounds(bounds,{padding:{top:100,bottom:150,left:55,right:55},maxZoom:15,duration:400});}}});
  OrientOutings.init({...privatePlaceAPI,origin:()=>state.origin,originLabel:()=>state.originLabel||store.home?.name||'your chosen area',useMapCenter:()=>{if(!map){toast('The map is still loading.');return false;}const c=map.getCenter();state.origin=[c.lng,c.lat];state.originLabel='chosen map center';render();return true;}});
  OrientToday.init({...privatePlaceAPI,origin:()=>state.origin,originLabel:()=>state.originLabel||store.home?.name||'your chosen area'});
  const refreshCalendar=()=>{if(!document.hidden&&(state.tab==='Calendar'||exploreOverview())&&!document.querySelector('dialog[open]')&&!$('#panel').classList.contains('briefing-dragging')&&!$('#panel').contains(document.activeElement?.matches('input,textarea,select,[contenteditable=true]')?document.activeElement:null)){const panel=$('#panel'),body=panel.querySelector('.briefing-body'),scroll=body?body.scrollTop:panel.scrollTop;render();const target=panel.querySelector('.briefing-body')||panel;target.scrollTop=scroll;}};
  document.addEventListener('visibilitychange',refreshCalendar);
  window.addEventListener('focus',refreshCalendar);
  setInterval(refreshCalendar,30000);
  render();
  if(!storageWorks)toast('Saved data could not be read. Export any changes you want to keep.');
  try {
    if(!window.maplibregl)throw new Error('Map engine unavailable');
    map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/liberty',center:OrientAreas.view()?.center||OrientAreas.area()?.coordinates||store.home?.coordinates||[0,20],zoom:OrientAreas.view()?.zoom||(store.home?12:2),attributionControl:false,pitchWithRotate:false});
    map.on('moveend',()=>OrientAreas.remember());
    map.addControl(new maplibregl.AttributionControl({compact:false}),'bottom-right');
    map.addControl(new maplibregl.ScaleControl({maxWidth:80,unit:'imperial'}),'bottom-left');
    map.on('load',()=>{mapLoaded=true;$('#map-status').hidden=true;
      // Keep labels legible while giving the basemap Orient's field-map palette.
      for(const layer of map.getStyle().layers){try{if(layer.type==='background')map.setPaintProperty(layer.id,'background-color','#e5ecdf');if(layer.type==='fill'&&/water/.test(layer.id))map.setPaintProperty(layer.id,'fill-color','#a4cbc7');if(layer.type==='fill'&&/park|landcover_wood|landuse_park/.test(layer.id))map.setPaintProperty(layer.id,'fill-color','#cadbc5');if(layer.type==='fill-extrusion')map.setLayoutProperty(layer.id,'visibility','none');}catch{}}
      renderMarkers();icons();
    });
    map.on('move',updateFog);
    map.on('error',()=>{if(!mapLoaded){$('#map-status').textContent='Map connection unavailable. Places still work in List.';}});
    map.on('click',e=>{
      if(state.filters){state.filters=false;render();return;}
      const features=map.queryRenderedFeatures([[e.point.x-12,e.point.y-12],[e.point.x+12,e.point.y+12]]);
      const feature=features.find(f=>f.properties?.name&&f.geometry?.type==='Point'&&(/poi/.test(f.sourceLayer||'')||/poi/.test(f.layer?.id||'')));
      if(!feature)return;
      const coords=feature.geometry.coordinates.slice(0,2);const name=String(feature.properties.name);
      const existing=allPlaces().find(p=>p.name.toLowerCase()===name.toLowerCase()&&OrientPlaces.distance(p.coordinates,coords)<150);
      if(existing){selectPlace(existing.id,{expand:true});return;}
      loadNearby({id:'map-label',name,coordinates:coords,kind:'Place'},{mapName:name});
    });
    renderMarkers();icons();
    setTimeout(()=>{if(!mapLoaded){$('#map-status').textContent='Still loading the map. You can use List while it connects.';}},12000);
  } catch {
    $('#map-status').textContent='Map unavailable in this browser. Explore your places as a list.';state.list=true;render();
  }
})();


