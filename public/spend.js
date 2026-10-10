'use strict';
// What you spend, kept privately. Two small records, both on this device (and your own sync, like the rest of the map):
//   store.spend[placeId]     = [ { id:'sp-…', day:'2026-10-09', cents:1850 } , … ]   money you chose to write down
//   store.ownership[placeId] = 'local' | 'chain'                                      your call; Orient only suggests
// The place card gets a "Spending" section (total, average, a local-or-chain switch), and My Map gets "Where your money goes":
// how much of what you wrote down stayed with local, independent businesses, against chains and corporations. Nothing here is
// read from a bank or a card, and nothing leaves the device unless you export your map.
window.OrientSpend=(()=>{
  let api=null;
  const MAX_PER_PLACE=400,MAX_CENTS=10000000,DAY=86400000;
  const RANGES=[[30,'30 days'],[365,'12 months'],[0,'All time']];
  const OWNERS={local:'Local',chain:'Chain'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
  const pad=n=>String(n).padStart(2,'0');
  const localDay=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
  const dayTime=v=>new Date(+v.slice(0,4),+v.slice(5,7)-1,+v.slice(8,10),12).getTime();

  // ── money ──────────────────────────────────────────────────────────────────
  function fmt(cents){
    const whole=cents%100===0;
    return '$'+(cents/100).toLocaleString('en-US',{minimumFractionDigits:whole?0:2,maximumFractionDigits:2});
  }
  // "18.5", "$18.50", "1,250" → cents; anything else → null.
  function parseAmount(text){
    const s=String(text??'').trim().replace(/^\$/,'').replace(/,/g,'');
    if(!/^\d{1,7}(\.\d{1,2})?$/.test(s))return null;
    const cents=Math.round(parseFloat(s)*100);
    return cents>=1&&cents<=MAX_CENTS?cents:null;
  }
  function validDay(v,now=Date.now()){
    if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||+v.slice(0,4)<2000)return false;
    const t=dayTime(v);return Number.isFinite(t)&&localDay(new Date(t))===v&&t<=now+2*DAY;
  }

  // ── what is kept ───────────────────────────────────────────────────────────
  // Sanitize what a saved or imported map says about spending.
  function clean(raw,ids){
    const spend={},ownership={};
    for(const [id,list] of Object.entries(raw?.spend&&typeof raw.spend==='object'?raw.spend:{}).slice(0,1000)){
      if(!ids.has(id)||!Array.isArray(list))continue;
      const seen=new Set(),keep=[];
      for(const e of list.slice(-MAX_PER_PLACE)){
        if(!e||typeof e!=='object'||typeof e.id!=='string'||!/^[A-Za-z0-9-]{1,40}$/.test(e.id)||seen.has(e.id))continue;
        if(!Number.isInteger(e.cents)||e.cents<1||e.cents>MAX_CENTS||!validDay(e.day))continue;
        seen.add(e.id);keep.push({id:e.id,day:e.day,cents:e.cents});
      }
      if(keep.length)spend[id]=keep;
    }
    for(const [id,v] of Object.entries(raw?.ownership&&typeof raw.ownership==='object'?raw.ownership:{}).slice(0,2000))if(ids.has(id)&&Object.hasOwn(OWNERS,v))ownership[id]=v;
    return {spend,ownership,spendRange:[0,30,365].includes(raw?.spendRange)?raw.spendRange:0};
  }
  const books=()=>{const s=api.store();return s.spend||(s.spend={});};
  const owners=()=>{const s=api.store();return s.ownership||(s.ownership={});};
  const entries=id=>(api?.store().spend?.[id]||[]).slice();
  const ownerOf=id=>api?.store().ownership?.[id]||'';
  const totalOf=id=>entries(id).reduce((s,e)=>s+e.cents,0);
  const newId=()=>'sp-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

  // A hint only, never counted until you confirm: well-known chains and corporations by name (or a brand the source gave).
  const CHAINS=/\b(starbucks|mcdonald'?s|burger king|wendy'?s|taco bell|subway|dunkin|panera|chipotle|chick-fil-a|domino'?s|pizza hut|papa john'?s|little caesars|kfc|arby'?s|sonic drive|popeyes|jimmy john'?s|jersey mike'?s|culver'?s|panda express|olive garden|applebee'?s|chili'?s|ihop|denny'?s|waffle house|buffalo wild wings|texas roadhouse|outback|red lobster|cracker barrel|bob evans|tim hortons|krispy kreme|white castle|five guys|walmart|target|kroger|meijer|aldi|costco|sam'?s club|home depot|lowe'?s|best buy|cvs|walgreens|rite aid|dollar general|dollar tree|family dollar|barnes (&|and) noble|gamestop|7-eleven|speedway|sunoco|circle k|amazon|whole foods|trader joe'?s|petsmart|petco|michaels|joann|hobby lobby|autozone|o'?reilly auto|advance auto|ulta|sephora|big lots|tractor supply|menards|bp|shell)\b/i;
  function guess(p){
    if(!p)return '';
    return CHAINS.test(String(p.brand||'')+' '+String(p.name||''))?'chain':'';
  }

  // ── changes ────────────────────────────────────────────────────────────────
  // Returns an error message, or '' when it was written down.
  function add(id,amountText,day=localDay(new Date())){
    const cents=parseAmount(amountText);
    if(cents===null)return 'Type an amount like 18.50.';
    if(!validDay(day))return 'Choose a date.';
    if(day>localDay(new Date()))return 'That day has not happened yet.';
    const list=entries(id).slice(-(MAX_PER_PLACE-1));
    list.push({id:newId(),day,cents});
    books()[id]=list;
    api.keepOsm?.(id);api.save();api.render();return '';
  }
  function remove(id,entryId){
    const list=entries(id).filter(e=>e.id!==entryId);
    if(list.length)books()[id]=list;else delete books()[id];
    api.save();api.render();
  }
  function setOwner(id,value){
    if(!id)return;
    if(!Object.hasOwn(OWNERS,value)||ownerOf(id)===value)delete owners()[id];else owners()[id]=value;
    api.keepOsm?.(id);api.save();api.render();
  }
  // Used when a place is removed from the map.
  function forget(store,id){delete store.spend?.[id];delete store.ownership?.[id];}

  // ── words ──────────────────────────────────────────────────────────────────
  function dayLabel(v){
    const d=new Date(dayTime(v)),today=new Date(),y=new Date(Date.now()-DAY);
    return localDay(d)===localDay(today)?'Today':localDay(d)===localDay(y)?'Yesterday':d.toLocaleDateString(undefined,{month:'short',day:'numeric',...(d.getFullYear()===today.getFullYear()?{}:{year:'numeric'})});
  }
  function ownerLine(id,p){
    const o=ownerOf(id);
    if(o==='local')return 'Counted as local: an independent business, owned and run here.';
    if(o==='chain')return 'Counted as a chain or corporate business.';
    return guess(p)==='chain'?'Looks like a chain. Choose Chain to confirm, or Local if that is wrong.':'Choose one so this place counts in Where your money goes.';
  }

  // ── the place card ─────────────────────────────────────────────────────────
  const lastEntry=id=>entries(id).map((e,i)=>({...e,i})).sort((a,b)=>b.day.localeCompare(a.day)||b.i-a.i)[0]||null;
  function section(p){
    const id=p.id,list=entries(id).map((e,i)=>({...e,i})).sort((a,b)=>b.day.localeCompare(a.day)||b.i-a.i),n=list.length,total=list.reduce((s,e)=>s+e.cents,0),o=ownerOf(id);
    const stats=n?`<div class="spend-stats"><div><b>${fmt(total)}</b><small>spent in all</small></div><div><b>${fmt(Math.round(total/n))}</b><small>average · ${plural(n,'time')}</small></div><div><b>${esc(dayLabel(list[0].day))}</b><small>last spent</small></div></div>`:'';
    const sug=!o&&guess(p)==='chain';
    return `<section class="spend-place" aria-label="Spending"><h3>Spending</h3>${n?`<span class="tag">${esc(fmt(total))} total</span>`:''}`
      +`<p class="fine">${n?'What you wrote down at this place. Private to you.':'Write down what you spend here, and Orient keeps the total and the average. Private to you.'}</p>`
      +stats
      +`<div class="spend-owner" role="radiogroup" aria-label="Is this business local or a chain?">`
        +`<button type="button" role="radio" aria-checked="${o==='local'}" data-spend-owner="local" class="${o==='local'?'on ':''}loc">${icon('store')}Local</button>`
        +`<button type="button" role="radio" aria-checked="${o==='chain'}" data-spend-owner="chain" class="${o==='chain'?'on ':''}chn${sug?' suggest':''}">${icon('building-2')}Chain</button></div>`
      +`<p class="fine spend-owner-note">${esc(ownerLine(id,p))}</p>`
      +(n?`<button type="button" class="button full spend-repeat" data-spend-repeat>${icon('rotate-ccw')}Same as last time · ${esc(fmt(list[0].cents))}</button>`:'')
      +`<form class="spend-add" data-spend-form autocomplete="off"><label>Spent<span class="spend-money"><span aria-hidden="true">$</span><input name="spend-amount" inputmode="decimal" maxlength="10" placeholder="0.00" aria-label="Amount spent, in dollars"></span></label>`
        +`<label>On<input type="date" name="spend-day" value="${localDay(new Date())}" max="${localDay(new Date())}" min="2000-01-01"></label><button type="submit" class="button primary">Add</button></form>`
      +`<p class="fine" id="spend-status" role="status" aria-live="polite"></p>`
      +(n?`<ul class="spend-list">${list.slice(0,8).map(e=>`<li><span>${esc(dayLabel(e.day))}</span><b>${esc(fmt(e.cents))}</b><button type="button" class="visit-remove" data-spend-remove="${esc(e.id)}" aria-label="Remove ${esc(fmt(e.cents))} from ${esc(dayLabel(e.day))}">${icon('x')}</button></li>`).join('')}</ul>${n>8?`<p class="fine">Showing the latest 8 of ${n}.</p>`:''}`:'')
      +`</section>`;
  }

  // ── My Map: where your money goes ──────────────────────────────────────────
  const rangeDays=()=>{const d=api.store().spendRange;return [0,30,365].includes(d)?d:0;};
  // Totals in the range, split by what you called each place; `places` is the biggest first.
  function rollup(days=rangeDays(),now=Date.now()){
    const byId=new Map(api.places().map(p=>[p.id,p])),cutoff=days?localDay(new Date(now-days*DAY)):'';
    const out={total:0,local:0,chain:0,none:0,count:0,places:[]};
    for(const [id,list] of Object.entries(api.store().spend||{})){
      const p=byId.get(id);if(!p)continue;
      const rows=list.filter(e=>!cutoff||e.day>=cutoff);if(!rows.length)continue;
      const cents=rows.reduce((s,e)=>s+e.cents,0),o=ownerOf(id)||'none';
      out.total+=cents;out[o]+=cents;out.count+=rows.length;out.places.push({id,p,cents,n:rows.length,owner:o});
    }
    out.places.sort((a,b)=>b.cents-a.cents||a.p.name.localeCompare(b.p.name));
    return out;
  }
  // The last six months, oldest first, each split by what you called the place. Only places still on your map count.
  function months(now=Date.now()){
    const byId=new Set(api.places().map(p=>p.id)),out=[],d=new Date(now);
    for(let i=5;i>=0;i--){const m=new Date(d.getFullYear(),d.getMonth()-i,1);out.push({key:m.getFullYear()+'-'+pad(m.getMonth()+1),label:m.toLocaleDateString(undefined,{month:'short'}),local:0,chain:0,none:0,total:0});}
    for(const [id,list] of Object.entries(api.store().spend||{})){
      if(!byId.has(id))continue;const o=ownerOf(id)||'none';
      for(const e of list){const m=out.find(x=>x.key===e.day.slice(0,7));if(m){m[o]+=e.cents;m.total+=e.cents;}}
    }
    return out;
  }
  function trend(){
    const ms=months(),filled=ms.filter(m=>m.total>0);if(filled.length<2)return '';
    const top=Math.max(...ms.map(m=>m.total));
    const col=m=>`<div class="spend-month"><b>${m.total?esc(fmt(m.total)):''}</b><div class="spend-barwrap"><div class="spend-col" style="height:${m.total?Math.max(6,Math.round(m.total/top*100)):0}%">${['local','chain','none'].map(k=>m[k]?`<i class="${k==='local'?'loc':k==='chain'?'chn':'uns'}" style="flex-grow:${m[k]}"></i>`:'').join('')}</div></div><span>${esc(m.label)}</span></div>`;
    return `<div class="spend-trend" role="img" aria-label="${esc('Month by month: '+filled.map(m=>m.label+' '+fmt(m.total)).join(', '))}">${ms.map(col).join('')}</div>`;
  }
  function summary(){
    if(!api||!Object.keys(api.store().spend||{}).length)return '';
    const days=rangeDays(),r=rollup(days),label=RANGES.find(x=>x[0]===days)[1].toLowerCase();
    const sorted=r.local+r.chain,pct=sorted?Math.round(r.local/sorted*100):null;
    const head=`<div class="spend-summary-head"><h3>Where your money goes</h3><div class="visit-chips" role="group" aria-label="Time range">${RANGES.map(([d,l])=>`<button type="button" class="chip${d===days?' on':''}" data-spend-range="${d}" aria-pressed="${d===days}">${l}</button>`).join('')}</div></div>`;
    if(!r.total)return `<section class="spend-summary" aria-label="Where your money goes">${head}<p class="fine">Nothing written down in the last ${esc(label)}.</p></section>`;
    const FIELD={loc:'local',chn:'chain',uns:'none'};
    const part=(k,l)=>`<li class="${k}"><i aria-hidden="true"></i><span>${l}</span><b>${esc(fmt(r[FIELD[k]]))}</b></li>`;
    const seg=(k,c)=>c?`<i class="${k}" style="flex-grow:${c}"></i>`:'';
    return `<section class="spend-summary" aria-label="Where your money goes">${head}`
      +`<p class="spend-big">${pct===null?`<b>${esc(fmt(r.total))}</b> written down`:`<b>${pct}%</b> of what you sorted stayed local`}</p>`
      +`<p class="fine">${esc(fmt(r.total))} across ${plural(r.count,'purchase')} at ${plural(r.places.length,'place')}${days?` in the last ${esc(label)}`:' so far'}.${pct===null?' Mark places Local or Chain to see the split.':''}</p>`
      +`<div class="spend-bar" role="img" aria-label="${esc(`${fmt(r.local)} local, ${fmt(r.chain)} chain or corporate, ${fmt(r.none)} not sorted yet`)}">${seg('loc',r.local)}${seg('chn',r.chain)}${seg('uns',r.none)}</div>`
      +`<ul class="spend-legend">${part('loc','Local')}${part('chn','Chain or corporate')}${r.none?part('uns','Not sorted yet'):''}</ul>`
      +trend()
      +r.places.slice(0,5).map(x=>`<button class="row spend-row" data-place="${esc(x.id)}"><span class="tile">${icon(x.p.icon||'map-pin')}</span><span class="row-copy"><strong>${esc(x.p.name)}</strong><small>${esc(fmt(x.cents))} · ${plural(x.n,'time')} · ${x.owner==='local'?'Local':x.owner==='chain'?'Chain':'Not sorted'}</small></span><i class="spend-dot ${x.owner==='local'?'loc':x.owner==='chain'?'chn':'uns'}" aria-hidden="true"></i>${icon('chevron-right')}</button>`).join('')
      +(r.none?`<p class="fine">${esc(fmt(r.none))} at ${plural(r.places.filter(x=>x.owner==='none').length,'place')} is not sorted yet. Open a place and choose Local or Chain.</p>`:'')
      +`<p class="fine">Only what you wrote down, kept on this device. “Local” is your call.</p></section>`;
  }

  // ── for exports ────────────────────────────────────────────────────────────
  // Dollars spent and the local/chain call for one place in a saved map (a plain store, not the live one).
  function exportFacts(store,id){
    const list=Array.isArray(store.spend?.[id])?store.spend[id]:[],cents=list.reduce((s,e)=>s+(Number.isInteger(e?.cents)?e.cents:0),0);
    return {spent:cents?(cents/100).toFixed(2):'',ownership:Object.hasOwn(OWNERS,store.ownership?.[id])?store.ownership[id]:''};
  }

  function init(a){
    api=a;
    document.addEventListener('click',e=>{
      const own=e.target.closest('[data-spend-owner]');if(own){setOwner(api.selected(),own.dataset.spendOwner);return;}
      const rp=e.target.closest('[data-spend-repeat]');if(rp){const id=api.selected(),l=id&&lastEntry(id);if(l)add(id,(l.cents/100).toFixed(2));return;}
      const rm=e.target.closest('[data-spend-remove]');if(rm){const id=api.selected();if(id)remove(id,rm.dataset.spendRemove);return;}
      const rg=e.target.closest('[data-spend-range]');if(rg){const d=Number(rg.dataset.spendRange);api.store().spendRange=[0,30,365].includes(d)?d:0;api.save();api.render();}
    });
    document.addEventListener('submit',e=>{
      const f=e.target.closest?.('[data-spend-form]');if(!f)return;
      e.preventDefault();
      const id=api.selected(),msg=id?add(id,f.elements['spend-amount'].value,f.elements['spend-day'].value):'';
      if(msg){const s=document.querySelector('#spend-status');if(s)s.textContent=msg;}
    });
  }
  const status=()=>({places:Object.keys(api.store().spend||{}).length,range:rangeDays()});
  return {init,clean,section,summary,months,rollup,add,remove,setOwner,forget,guess,parseAmount,fmt,entries,ownerOf,totalOf,exportFacts,validDay,status};
})();
