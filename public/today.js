/* A local daily briefing, derived from the same schedules as Calendar. */
'use strict';
window.OrientToday=(()=>{
  let api,showAll=false,briefingDate='';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const empty=s=>'<p class="today-empty">'+s+'</p>';
  function render(panel,query=''){
    const date=OrientCalendar.today();if(date!==briefingDate){briefingDate=date;showAll=false;}const store=api.store(),places=api.places(),byId=new Map(places.map(p=>[p.id,p]));
    const miles=p=>OrientPlaces.distance(api.origin(),p.coordinates)/1609.344;
    const matches=(p,extra='')=>!query||(p.name+' '+p.kind+' '+extra).toLowerCase().includes(query.toLowerCase());
    const entries=OrientCalendar.occurrences(OrientWebsite.allEvents(),date,date).filter(e=>byId.has(e.placeId)&&matches(byId.get(e.placeId),e.title+' '+(e.note||'')));
    const specialGroups=new Map();for(const e of entries.filter(e=>e.kind==='Special'&&miles(byId.get(e.placeId))<=10)){if(!specialGroups.has(e.placeId))specialGroups.set(e.placeId,[]);specialGroups.get(e.placeId).push(e);}
    const groups=[...specialGroups].sort((a,b)=>miles(byId.get(a[0]))-miles(byId.get(b[0]))||byId.get(a[0]).name.localeCompare(byId.get(b[0]).name));
    const events=entries.filter(e=>e.kind!=='Special'&&store.saved.includes(e.placeId));
    const unvisited=places.filter(p=>store.saved.includes(p.id)&&!store.visited.includes(p.id)&&miles(p)<=10&&matches(p)).sort((a,b)=>miles(a)-miles(b)||a.name.localeCompare(b.name)).slice(0,3);
    const placeButton=(p,reason)=>'<button class="today-place" data-place="'+esc(p.id)+'" data-expand="true"><span><strong>'+esc(p.name)+'</strong><small>'+esc(p.kind)+' · '+miles(p).toFixed(1)+' mi'+(store.ratings?.[p.id]?' · ★ '+store.ratings[p.id]+'/5':'')+'</small></span><span aria-hidden="true">↗</span></button>'+(reason?'<p class="today-reason">'+esc(reason)+'</p>':'');
    const offer=e=>'<li><strong>'+esc(e.title)+'</strong><small>'+esc(e.time?(e.time+(e.endTime?'–'+e.endTime:'')):'Time unspecified')+(e.sharedSource?' · Shared listing':e.webSource?' · Website listing':' · Your entry')+'</small>'+(e.sourceURL?'<span class="today-source">'+OrientWebsite.link(e.sourceURL,'Source')+(e.sourceDate?' · Read '+esc(e.sourceDate.slice(0,10)):'')+'</span>':'')+'</li>';
    panel.innerHTML='<div class="today-heading"><div class="kicker">'+esc(new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric'}))+'</div><h2>What could you do today?</h2><p class="sub">A few reasons to step out. Around '+esc(api.originLabel())+'.</p></div>'+
      OrientOutings.entry()+'<section class="today-section" aria-label="Specials today"><div class="today-section-title"><h3>Specials today</h3><span>WITHIN 10 MI</span></div>'+(groups.length?(showAll?groups:groups.slice(0,4)).map(([id,list])=>'<article class="today-card">'+placeButton(byId.get(id),'')+'<ul class="today-offers">'+list.map(offer).join('')+'</ul></article>').join('')+(groups.length>4?'<button class="button full" data-today-specials>'+ (showAll?'Show fewer specials':'Show all '+groups.length+' places with specials')+'</button>':''):empty('No listed specials'+(query?' matching your search':' nearby')+' today.'))+'</section>'+
      '<section class="today-section" aria-label="At your places"><div class="today-section-title"><h3>At your places</h3><span>TODAY</span></div>'+(events.length?events.map(e=>'<article class="today-card">'+placeButton(byId.get(e.placeId),'')+'<ul class="today-offers">'+offer(e)+'</ul></article>').join(''):empty('No events'+(query?' matching your search':' at your saved places')+' today.'))+'</section>'+
      '<section class="today-section" aria-label="Still on your list"><div class="today-section-title"><h3>Still on your list</h3><span>UNVISITED</span></div>'+(unvisited.length?unvisited.map(p=>'<article class="today-card">'+placeButton(p,'Saved for later. Maybe today?')+'</article>').join(''):empty('Save somewhere you’d like to try. Unvisited places within 10 miles will appear here.'))+'</section>'+
      '<button class="button full" data-tab="Calendar">Look ahead in Calendar →</button><p class="fine today-footnote">Toledo time · Listed for today doesn’t mean open now. Shared offers include their source; confirm details with the venue.</p>';
    panel.dataset.today=date;
  }
  return {init:a=>{api=a;document.addEventListener('click',e=>{if(e.target.closest('[data-today-specials]')){showAll=!showAll;api.render();}});},render};
})();
