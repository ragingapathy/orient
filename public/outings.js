/* Temporary, local outing suggestions. No location tracking or remote recommendations. */
'use strict';
window.OrientOutings=(()=>{
  let api,dialog;
  const prefs={minutes:'45',budget:'10',mode:'walking',social:'solo'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function type(p){
    const k=String(p.kind||'').toLowerCase();
    if(/pantry|resource|service|auto|medical|health/.test(k))return '';
    if(/park|public space|trail|garden|library/.test(k))return 'wander';
    if(/comic|book|game|shop|record|market/.test(k))return 'browse';
    if(/coffee|cafe|café|food|drink|restaurant|bar|pub/.test(k))return 'pause';
    return '';
  }
  function suggest(places,store,origin,options,entries=[],nowMinute=0){
    return places.flatMap(p=>{
      const activity=type(p),rating=Number(store.ratings?.[p.id]||0);
      if(!activity||p.demo||rating&&rating<=2||!Array.isArray(p.coordinates)||p.coordinates.length!==2||!p.coordinates.every(Number.isFinite))return [];
      // Without verified prices, a no-spend plan only proposes an outdoor walk.
      if(options.budget==='0'&&(activity!=='wander'||/library/i.test(p.kind)))return [];
      const distance=OrientPlaces.distance(origin,p.coordinates);
      if(!Number.isFinite(distance))return [];
      const travel=Math.ceil(distance*1.5*2/(options.mode==='walking'?67:400))+(options.mode==='walking'?0:10);
      const minutes=travel+20;
      if(minutes>Number(options.minutes))return [];
      const saved=store.saved.includes(p.id),visited=store.visited.includes(p.id);
      const fit=options.social==='solo'?(activity==='pause'?0:8):options.social==='company'?(activity==='pause'?8:0):0;
      const reasons=options.budget==='0'?[]:entries.filter(e=>e.placeId===p.id).flatMap(e=>{
        const toMinutes=t=>/^\d{2}:\d{2}$/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3)):null;
        const start=toMinutes(e.time),end=toMinutes(e.endTime),arrival=nowMinute+Math.ceil(travel/2);
        if(start!==null){
          if(e.kind!=='Special'&&start<arrival)return [];
          if(e.kind==='Special'&&start<arrival&&end===null)return [];
          const wait=Math.max(0,start-arrival);
          if(minutes+wait>Number(options.minutes))return [];
          if(end!==null&&!(e.endDate>e.date)&&end<arrival+wait+20)return [];
          return [{...e,wait}];
        }
        return [{...e,wait:0}];
      });
      reasons.sort((a,b)=>Number(b.kind==='Special')-Number(a.kind==='Special')||a.wait-b.wait);
      const reason=reasons[0],timely=reason?(reason.kind==='Special'?40:options.social==='solo'?12:40):0;
      return [{p,activity,distance,minutes:minutes+(reason?.wait||0),saved,visited,reason,score:(saved?25:0)+(!visited?15:0)+rating*3+fit+timely-distance/1000}];
    }).sort((a,b)=>b.score-a.score||a.p.name.localeCompare(b.p.name)).slice(0,2);
  }
  function results(){
    const root=dialog.querySelector('#outing-results');
    const date=OrientCalendar.today(),parts=new Intl.DateTimeFormat('en-GB',{timeZone:OrientHome.timeZone(),hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    const nowMinute=Number(parts.find(p=>p.type==='hour').value)*60+Number(parts.find(p=>p.type==='minute').value);
    const entries=OrientCalendar.occurrences(OrientWebsite.allEvents(),date,date);
    const choices=suggest(api.places(),api.store(),api.origin(),prefs,entries,nowMinute);
    root.innerHTML=choices.length?choices.map((c,i)=>{
      const action=prefs.budget==='0'?'A short walk near':c.activity==='browse'?'A little browsing at':c.activity==='wander'?'A little exploring at':'Take a breather at';
      const why=c.saved?(c.visited?'A familiar place on your map.':'You saved it and haven’t marked a visit yet.'):'A place already known to your map.';
      const e=c.reason,timing=e?'<div class="outing-today"><span class="kicker">'+(e.kind==='Special'?'TODAY’S SPECIAL':'HAPPENING TODAY')+'</span><strong>'+esc(e.title)+'</strong><small>'+esc(e.time?(e.time+(e.endTime?'–'+e.endTime:''))+' · '+OrientHome.timeZone()+' time':'Time unspecified')+' · '+(e.sharedSource?'Shared listing':e.webSource?'Website listing':'Your entry')+'</small>'+(e.sourceURL?OrientWebsite.link(e.sourceURL,'View source'):'')+'<small>Listed today; confirm hours and availability.'+(e.kind!=='Special'?' Time allowance is for a short visit, not the full event.':'')+'</small></div>':'';
      return '<article class="outing-choice"><div class="kicker">POSSIBILITY '+(i+1)+'</div><p class="outing-intent">'+action+'</p><h3>'+esc(c.p.name)+'</h3><p class="fine">'+esc(c.p.kind)+' · '+(c.distance/1609.344).toFixed(1)+' mi away'+(api.store().ratings?.[c.p.id]?' · ★ '+api.store().ratings[c.p.id]+'/5':'')+'</p>'+timing+'<p>'+why+'</p><p class="fine">Allow roughly '+(Math.ceil(c.minutes/5)*5)+' minutes for a 20-minute stop'+(e?.wait?' and waiting for the listed start':'')+' and a return '+(prefs.mode==='walking'?'walk':'drive')+'.</p><div class="outing-actions"><button class="button" data-outing-place="'+esc(c.p.id)+'">See place</button><a class="button primary" '+OrientDirections.attrs(c.p.coordinates,c.p.name,prefs.mode)+'>Directions ↗</a></div></article>';
    }).join(''):'<p class="today-empty">No suitable places fit this plan yet. Try more time, choose a closer map center, or add a park, shop, or café you’d like to explore.</p>';
    dialog.querySelector('#outing-origin').textContent='Starting from '+api.originLabel()+'. This is not your GPS location.';
    dialog.querySelector('#outing-budget-note').textContent=prefs.budget==='0'?'No-spend plans suggest a walk near a park or public space. Access and parking fees are unverified.':'Your '+(prefs.budget==='flexible'?'flexible budget':'$'+prefs.budget+' spending limit')+' is a reminder, not a verified price filter. Prices are unknown; any purchase is your choice.';
  }
  function open(){
    if(!dialog){dialog=document.createElement('dialog');dialog.id='outing-dialog';dialog.setAttribute('aria-labelledby','outing-title');document.body.append(dialog);
      dialog.addEventListener('change',e=>{if(e.target.dataset.outingPref){prefs[e.target.dataset.outingPref]=e.target.value;results();}});
      dialog.addEventListener('click',e=>{if(e.target.closest('[data-outing-close]'))dialog.close();const place=e.target.closest('[data-outing-place]');if(place){dialog.close();api.select(place.dataset.outingPlace);}if(e.target.closest('[data-outing-center]')){if(api.useMapCenter())results();}});
    }
    const select=(key,title,values)=>'<label>'+title+'<select data-outing-pref="'+key+'">'+values.map(([v,label])=>'<option value="'+v+'"'+(prefs[key]===v?' selected':'')+'>'+label+'</option>').join('')+'</select></label>';
    dialog.innerHTML='<div class="panel-heading"><div><div class="kicker">A SMALL CHANGE OF SCENE</div><h2 id="outing-title">Get me out for a bit</h2></div><button class="icon-button" data-outing-close aria-label="Close">×</button></div><p class="sub">What feels manageable right now?</p><div class="outing-prefs">'+select('minutes','Time to spare',[['30','30 minutes'],['45','45 minutes'],['60','An hour'],['90','90 minutes']])+select('mode','Getting there',[['walking','Walking'],['driving','Driving']])+select('budget','Spending limit',[['0','No spending'],['10','Up to $10'],['25','Up to $25'],['flexible','Flexible']])+select('social','People energy',[['solo','Doing my own thing'],['company','Somewhere with people'],['either','Either feels good']])+'</div><p id="outing-origin" class="fine"></p><button class="button" data-outing-center>Start from map center</button><p id="outing-budget-note" class="fine"></p><div id="outing-results" aria-live="polite"></div><p class="fine outing-caveat">Travel is a rough round-trip estimate from straight-line distance, with extra allowance; routes, traffic and opening hours aren’t checked. People energy gently favors place types, not verified atmosphere. These choices stay only for this session.</p>';
    results();dialog.showModal();
  }
  return {suggest,init:a=>{api=a;document.addEventListener('click',e=>{if(e.target.closest('[data-outing-open]'))open();});},entry:()=>'<button class="outing-invitation" data-outing-open><span class="kicker">MAKE A LITTLE ROOM</span><strong>Get me out for a bit <span aria-hidden="true">↗</span></strong><span>A small outing that fits the time and energy you have.</span></button>'};
})();
