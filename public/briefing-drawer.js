/* Two-stop briefing drawer. Drag only the heading; the body scrolls independently. */
'use strict';
window.OrientBriefing=(()=>{
 function attach(panel,expanded,change){const handle=panel.querySelector('.briefing-handle');let drag=null,suppress=false;
 handle.addEventListener('click',e=>{e.preventDefault();if(!suppress)change(!expanded);});
 handle.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();change(e.key==='ArrowUp'||e.key==='End');panel.querySelector('.briefing-handle')?.focus({preventScroll:true});}});
 handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;const world=panel.parentElement.getBoundingClientRect(),search=document.querySelector('.searchbar').getBoundingClientRect(),bottom=world.bottom-panel.getBoundingClientRect().bottom;drag={id:e.pointerId,y:e.clientY,height:panel.getBoundingClientRect().height,full:Math.max(92,world.bottom-bottom-search.bottom-12),moved:false};handle.setPointerCapture(e.pointerId);});
 handle.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const delta=drag.y-e.clientY;if(Math.abs(delta)>5){drag.moved=true;panel.classList.add('briefing-dragging');panel.querySelector('.briefing-body').hidden=false;panel.style.height=Math.max(92,Math.min(drag.full,drag.height+delta))+'px';}});
 const finish=(e,cancel)=>{if(!drag||drag.id!==e.pointerId)return;const d=drag,delta=d.y-e.clientY;drag=null;panel.classList.remove('briefing-dragging');panel.style.removeProperty('height');if(!d.moved)return;suppress=true;setTimeout(()=>suppress=false,350);if(cancel){panel.querySelector('.briefing-body').hidden=!expanded;return;}change(Math.abs(delta)>28?delta>0:d.height+delta>(d.full+92)/2);};
 handle.addEventListener('pointerup',e=>finish(e,false));handle.addEventListener('pointercancel',e=>finish(e,true));
 }
 return {attach};
})();
