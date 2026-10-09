'use strict';
// Visits you log yourself, one tap each time. A place's visits are a private list in the browser:
//   store.visitLog[placeId] = [ '2026-10-09T14:03:00.000Z' | '2026-10-02' | '' , ... ]
// A full time comes from tapping the check on a place card; a plain date is a past visit you added by hand; an empty entry is a visit from
// before Orient kept dates (a place that was only "marked visited"). store.visited stays the set of places with at least one visit, so the
// rest of the app (pins, fog, milestones, Today) keeps working. Nothing here is tracked: every visit is something you pressed.
window.OrientVisits=(()=>{
  let api=null,lastLogged=null,undoTimer=null;
  const DAY=86400000,MAX_PER_PLACE=400;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
  const pad=n=>String(n).padStart(2,'0');
  const localDay=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;

  // ── entries ────────────────────────────────────────────────────────────────
  function validEntry(v,now=Date.now()){
    if(v==='')return true;
    if(typeof v!=='string')return false;
    if(/^\d{4}-\d{2}-\d{2}$/.test(v)){const t=new Date(+v.slice(0,4),+v.slice(5,7)-1,+v.slice(8,10),12).getTime();return Number.isFinite(t)&&localDay(new Date(t))===v&&+v.slice(0,4)>=2000&&t<=now+2*DAY;}
    if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)){const t=Date.parse(v);return Number.isFinite(t)&&new Date(t).getFullYear()>=2000&&t<=now+2*DAY;}
    return false;
  }
  // When an entry happened, in ms ('' has no time).
  function timeOf(v){
    if(!v)return null;
    if(/^\d{4}-\d{2}-\d{2}$/.test(v))return new Date(+v.slice(0,4),+v.slice(5,7)-1,+v.slice(8,10),12).getTime();
    const t=Date.parse(v);return Number.isFinite(t)?t:null;
  }
  // Sanitize what a saved or imported map says about visits. Places already marked visited count once, date unknown.
  function clean(raw,ids,visited=[]){
    const out={};
    for(const [id,list] of Object.entries(raw?.visitLog&&typeof raw.visitLog==='object'?raw.visitLog:{}).slice(0,600)){
      if(!ids.has(id)||!Array.isArray(list))continue;
      const keep=list.slice(-MAX_PER_PLACE).filter(v=>validEntry(v));
      if(keep.length)out[id]=keep;
    }
    for(const id of visited)if(!out[id])out[id]=[''];
    return out;
  }
  const log=()=>{const s=api.store();return s.visitLog||(s.visitLog={});};
  // A place marked visited without a log (older data, or another module) counts once.
  function entries(id){const l=api.store().visitLog?.[id]||[];return l.length?l:(api.store().visited.includes(id)?['']:[]);}
  const count=id=>entries(id).length;
  function lastTime(id){let best=null;for(const v of entries(id)){const t=timeOf(v);if(t!==null&&(best===null||t>best))best=t;}return best;}
  const inWindow=(id,days,now=Date.now())=>entries(id).filter(v=>{if(!days)return true;const t=timeOf(v);return t!==null&&t>=now-days*DAY&&t<=now+DAY;}).length;

  // ── changes ────────────────────────────────────────────────────────────────
  function add(id,at=new Date().toISOString()){
    const s=api.store(),l=log();
    const cur=(l[id]&&l[id].length?l[id]:(s.visited.includes(id)?['']:[])).slice(-(MAX_PER_PLACE-1));
    cur.push(at);l[id]=cur;
    if(!s.visited.includes(id))s.visited.push(id);
    return cur.length;
  }
  function removeAt(id,index){
    const s=api.store(),l=log();let cur=entries(id).slice();
    if(!Number.isInteger(index)||index<0||index>=cur.length)return false;
    cur.splice(index,1);
    if(cur.length){l[id]=cur;}else{delete l[id];s.visited=s.visited.filter(v=>v!==id);}
    api.save();api.render();return true;
  }
  function clear(id){const s=api.store();delete log()[id];s.visited=s.visited.filter(v=>v!==id);api.save();api.render();}
  const nameOf=id=>api.places().find(p=>p.id===id)?.name||'this place';

  function undoToast(message){
    const t=document.querySelector('#toast');if(!t)return;
    t.innerHTML=esc(message)+' <button type="button" class="toast-undo" data-action="visit-undo">Undo</button>';
    t.hidden=false;clearTimeout(undoTimer);undoTimer=setTimeout(()=>{t.hidden=true;},6000);
  }
  // The one-tap "I went again": a visit now. Two taps within 20 seconds count once.
  function tap(id){
    if(!id)return;
    if(lastLogged&&lastLogged.id===id&&Date.now()-lastLogged.t<20000){undoToast('Already logged a moment ago.');return;}
    api.keepOsm(id);
    const at=new Date().toISOString(),n=add(id,at);
    lastLogged={id,at,t:Date.now()};
    api.save();api.render();
    const recent=inWindow(id,14);
    undoToast(`${nameOf(id)}: visit ${n} logged${recent>1?` · ${recent} in the last 14 days`:''}.`);
  }
  function undo(){
    if(!lastLogged)return;
    const {id,at}=lastLogged,cur=entries(id),i=cur.lastIndexOf(at);
    lastLogged=null;clearTimeout(undoTimer);const t=document.querySelector('#toast');if(t)t.hidden=true;
    if(i>=0)removeAt(id,i);
  }
  // A visit on an earlier day, picked from a date box. Returns an error message or ''.
  function addOn(id,day){
    const today=localDay(new Date());
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return 'Choose a date.';
    if(day>today)return 'That day has not happened yet.';
    if(!validEntry(day))return 'Choose a date.';
    api.keepOsm(id);add(id,day);api.save();api.render();return '';
  }

  // ── words ──────────────────────────────────────────────────────────────────
  function when(v){
    if(!v)return 'Earlier · date not recorded';
    const t=timeOf(v),d=new Date(t),today=new Date(),y=new Date(Date.now()-DAY);
    const day=localDay(d)===localDay(today)?'Today':localDay(d)===localDay(y)?'Yesterday':d.toLocaleDateString(undefined,{month:'short',day:'numeric',...(d.getFullYear()===today.getFullYear()?{}:{year:'numeric'})});
    return /^\d{4}-\d{2}-\d{2}$/.test(v)?day:`${day}, ${d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;
  }
  function dayLabel(t){
    const d=new Date(t),today=new Date(),y=new Date(Date.now()-DAY);
    return localDay(d)===localDay(today)?'Today':localDay(d)===localDay(y)?'Yesterday':d.toLocaleDateString(undefined,{month:'short',day:'numeric',...(d.getFullYear()===today.getFullYear()?{}:{year:'numeric'})});
  }
  function line(id){
    const n=count(id);if(!n)return '';
    const t=lastTime(id);
    return `Been here ${plural(n,'time')}${t!==null?' · last '+dayLabel(t):''}`;
  }
  const rowLabel=id=>{const n=count(id);return n>1?`Visited ${n}×`:'Visited';};

  // ── markup ─────────────────────────────────────────────────────────────────
  function button(id,name){
    const n=count(id);
    return `<button type="button" class="visit${n?' counted':''}" data-action="log-visit" aria-label="Log a visit to ${esc(name)}. ${n?'Visited '+plural(n,'time')+' so far.':'Not visited yet.'}">${icon('check')}<b>${n||''}</b></button>`;
  }
  function section(id){
    const list=entries(id).map((v,i)=>({v,i,t:timeOf(v)})).sort((a,b)=>(b.t??-1)-(a.t??-1)||b.i-a.i);
    const n=list.length,recent=inWindow(id,14);
    return `<section class="visit-history" aria-label="Your visits"><h3>Your visits</h3>`
      +`<p class="fine">${n?plural(n,'visit')+(recent?` · ${recent} in the last 14 days`:''):'Tap the check at the top of this card each time you go. Orient keeps the count, privately.'}</p>`
      +(n?`<ul class="visit-list">${list.slice(0,30).map(e=>`<li><span>${esc(when(e.v))}</span><button type="button" class="visit-remove" data-action="visit-remove" data-visit-index="${e.i}" aria-label="Remove the visit from ${esc(when(e.v))}">${icon('x')}</button></li>`).join('')}</ul>${list.length>30?`<p class="fine">Showing the latest 30 of ${n}.</p>`:''}`:'')
      +`<div class="visit-add"><label>Add a visit on an earlier day<input type="date" name="visit-date" max="${localDay(new Date())}" min="2000-01-01"></label><button type="button" class="button" data-action="visit-add-date">Add that day</button></div>`
      +`<p class="fine" id="visit-add-status" role="status" aria-live="polite"></p>`
      +(n?`<button type="button" class="expand" data-action="visit-clear">Clear all visits to this place</button>`:'')
      +`</section>`;
  }

  // ── My Map: where you go ───────────────────────────────────────────────────
  const WINDOWS=[[14,'14 days'],[30,'30 days'],[0,'All time']];
  const windowDays=()=>{const d=api.store().visitDays;return [0,14,30].includes(d)?d:14;};
  function ranking(days=windowDays(),now=Date.now()){
    const places=new Map(api.places().map(p=>[p.id,p]));
    const rows=Object.keys({...(api.store().visitLog||{}),...Object.fromEntries(api.store().visited.map(id=>[id,1]))}).filter(id=>places.has(id)).map(id=>({id,p:places.get(id),n:inWindow(id,days,now),all:count(id),last:lastTime(id)})).filter(r=>r.n>0);
    return rows.sort((a,b)=>b.n-a.n||(b.last??0)-(a.last??0)||a.p.name.localeCompare(b.p.name));
  }
  function summary(){
    if(!api)return '';
    const total=api.store().visited.length;
    if(!total)return '';
    const days=windowDays(),rows=ranking(days),visits=rows.reduce((s,r)=>s+r.n,0),heat=api.store().heat===true;
    const label=WINDOWS.find(w=>w[0]===days)[1].toLowerCase();
    return `<section class="visit-summary" aria-label="Where you go"><div class="visit-summary-head"><h3>Where you go</h3><div class="visit-chips" role="group" aria-label="Time range">${WINDOWS.map(([d,l])=>`<button type="button" class="chip${d===days?' on':''}" data-action="visits-window" data-days="${d}" aria-pressed="${d===days}">${l}</button>`).join('')}</div></div>`
      +`<p class="fine">${rows.length?`${plural(visits,'visit')} to ${plural(rows.length,'place')}${days?` in the last ${label}`:' so far'}.`:`No visits in the last ${label}.`}</p>`
      +rows.slice(0,5).map(r=>`<button class="row" data-place="${esc(r.id)}"><span class="tile">${icon(r.p.icon||'map-pin')}</span><span class="row-copy"><strong>${esc(r.p.name)}</strong><small>${plural(r.n,'visit')}${days&&r.all!==r.n?` · ${r.all} in all`:''}${r.last!==null?' · last '+esc(dayLabel(r.last)):''}</small></span>${icon('chevron-right')}</button>`).join('')
      +`<button type="button" class="button full" data-action="visits-heat" aria-pressed="${heat}">${heat?'Hide the heat map':'Show the heat map on the map'}</button></section>`;
  }
  // Points for the map's heat layer: one per place, weighted by visits in the chosen range.
  function heatData(days=windowDays(),now=Date.now()){
    const rows=ranking(days,now).filter(r=>Array.isArray(r.p.coordinates)),top=Math.max(4,...rows.map(r=>r.n));
    // w is the visit count; n is that count against the busiest place in the range (never less than 4, so a few visits do not all look "hot")
    return {type:'FeatureCollection',features:rows.map(r=>({type:'Feature',geometry:{type:'Point',coordinates:r.p.coordinates},properties:{w:r.n,n:Math.min(1,r.n/top),id:r.id}}))};
  }
  const status=()=>({heat:api.store().heat===true,days:windowDays(),features:heatData().features.length,layer:!!api.hasHeatLayer?.()});

  function init(a){api=a;}
  function setWindow(days){const d=Number(days);api.store().visitDays=[0,14,30].includes(d)?d:14;api.save();api.render();}
  function toggleHeat(){const s=api.store();s.heat=!(s.heat===true);api.save();api.render();}
  return {init,clean,validEntry,timeOf,entries,count,add,removeAt,clear,tap,undo,addOn,line,rowLabel,button,section,summary,heatData,ranking,status,setWindow,toggleHeat,inWindow,lastTime};
})();
