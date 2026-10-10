'use strict';
// The icon a place wears on the map and on its card. Tap the icon on a place card to pick another one; the choice is yours and is kept per place:
//   store.details[placeId].icon = 'utensils' | …      (one of CHOICES below; nothing chosen means the usual icon)
// "The usual icon" is the category's, refined by a hint from the name for generic food places, so a bakery is not a coffee cup.
window.OrientIcons=(()=>{
  let api=null,dialog=null;
  const GROUPS=[
    ['Food & drink',['utensils','coffee','pizza','sandwich','croissant','cake','ice-cream-cone','cookie','soup','salad','beer','wine','martini','cup-soda']],
    ['Shops',['shopping-bag','shopping-cart','store','shirt','gem','book-open','gamepad-2','dices','puzzle','music','guitar','palette','scissors']],
    ['Culture & fun',['library','film','drama','camera','landmark','church','ticket','trophy','sparkles','popcorn']],
    ['Outdoors',['trees','tree-pine','flower-2','sprout','mountain','waves','tent','bike','sailboat','dog','bone','paw-print','sun','umbrella']],
    ['Services & places',['heart-pulse','stethoscope','pill','leaf','wrench','hammer','car','fuel','bus','train','plane','briefcase','banknote','wifi','school','graduation-cap','baby','dumbbell','hand-heart','house','building-2','users','bed-double']],
    ['Markers',['map-pin','star','heart','flame','shield-check','anchor']],
  ];
  const ALL=new Set(GROUPS.flatMap(g=>g[1]));
  const valid=name=>typeof name==='string'&&ALL.has(name);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const words=name=>name.replace(/-\d$/,'').replace(/-/g,' ');

  // A hint for places whose category says little ("Food & drink", "beverages", "Shopping"). Returns '' when the category's own icon is right.
  const KIND_HINTS=[[/^(food & drink|food|restaurant|eatery)$/i,'utensils'],[/^(beverages?|drinks?)$/i,'cup-soda'],[/^(shopping|shop|store|retail)$/i,'shopping-bag'],[/^(bakery)$/i,'croissant'],[/^(bar|pub)$/i,'beer']];
  const NAME_HINTS=[[/\b(bakery|bake shop|bakeshop|pastr(y|ies)|donuts?|doughnuts?|patisserie)\b/i,'croissant'],[/\bpizz(a|eria)\b/i,'pizza'],[/\b(burgers?|sandwich(es)?|subs?|deli|sub shop)\b/i,'sandwich'],[/\b(ice cream|creamery|gelato|frozen custard|custard)\b/i,'ice-cream-cone'],[/\b(pub|tavern|taproom|brewery|brewing|bar)\b/i,'beer'],[/\b(coffee|caf[eé]|espresso|roasters?|tea house|teahouse)\b/i,'coffee']];
  function hint(p){
    if(!p)return '';
    const kind=String(p.kind||'');
    const generic=KIND_HINTS.find(([re])=>re.test(kind));
    if(!generic)return '';
    if(generic[1]==='utensils'||generic[1]==='cup-soda'){const byName=NAME_HINTS.find(([re])=>re.test(String(p.name||'')));if(byName)return byName[1];}
    return generic[1];
  }
  // The icon to show for a place: your choice, else the hint, else whatever the place already carries.
  function iconFor(p,details){
    const chosen=details?.[p.id]?.icon;
    const want=valid(chosen)?chosen:hint(p);
    return want&&want!==p.icon?{...p,icon:want}:p;
  }
  // The category's icon, for the "use the usual icon" button.
  function usual(p,categoryIcon){return hint(p)||categoryIcon(p.baseKind||p.kind)||'map-pin';}

  function set(id,name){
    const s=api.store();s.details||={};
    if(!valid(name)){if(s.details[id])delete s.details[id].icon;}else s.details[id]={...(s.details[id]||{}),icon:name};
    api.keepOsm?.(id);api.save();api.render();
  }
  function open(id){
    const p=api.places().find(x=>x.id===id);if(!p)return;
    if(!dialog){dialog=document.createElement('dialog');dialog.id='icon-dialog';document.body.append(dialog);}
    dialog.setAttribute('aria-labelledby','icon-title');
    const chosen=api.store().details?.[id]?.icon,current=valid(chosen)?chosen:'';
    dialog.innerHTML=`<div class="panel-heading"><div><span class="ui-kicker">Icon</span><h2 id="icon-title">Choose an icon for ${esc(p.name)}</h2></div><button type="button" class="icon-button" data-icon-close aria-label="Close">×</button></div>`
      +GROUPS.map(([label,names])=>`<h3>${esc(label)}</h3><div class="icon-grid" role="radiogroup" aria-label="${esc(label)}">${names.map(n=>`<button type="button" role="radio" class="icon-choice${n===(current||p.icon)?' on':''}" data-icon-choice="${n}" aria-checked="${n===(current||p.icon)}" aria-label="${esc(words(n))}" title="${esc(words(n))}"><i data-lucide="${n}" aria-hidden="true"></i></button>`).join('')}</div>`).join('')
      +`<div class="icon-foot"><button type="button" class="button" data-icon-reset ${current?'':'disabled'}>Use the usual icon</button><button type="button" class="button" data-icon-close>Done</button></div>`
      +`<p class="fine">Only for your map. It changes how this place looks to you, nothing else.</p>`;
    dialog.dataset.placeId=id;
    if(window.lucide)lucide.createIcons();
    if(!dialog.open)dialog.showModal();
  }
  function init(a){
    api=a;
    document.addEventListener('click',e=>{
      const pick=e.target.closest('[data-icon-pick]');if(pick){e.stopPropagation();open(pick.dataset.iconPick);return;}
      if(!dialog||!dialog.contains(e.target))return;
      const id=dialog.dataset.placeId;
      const choice=e.target.closest('[data-icon-choice]');if(choice){set(id,choice.dataset.iconChoice);dialog.close();return;}
      if(e.target.closest('[data-icon-reset]')){set(id,'');dialog.close();return;}
      if(e.target.closest('[data-icon-close]'))dialog.close();
    },true);
  }
  return {init,valid,hint,iconFor,usual,set,open,GROUPS};
})();
