/* Three mobile snap stops; only the handle drags, leaving content scroll independent. */
'use strict';
window.OrientDrawer=(()=>{
 const mobile=matchMedia('(max-width:759px)');let current=null,gesture=null,suppress=false;
 function limits(sheet){const world=sheet.parentElement.getBoundingClientRect(),search=document.querySelector('.searchbar').getBoundingClientRect();const full=Math.max(110,world.bottom-search.bottom-12),previous=sheet.dataset.drawer,height=sheet.style.height;sheet.dataset.drawer='peek';sheet.style.height='auto';const natural=sheet.scrollHeight;sheet.dataset.drawer=previous;sheet.style.height=height;return [88,Math.min(full-24,Math.max(180,Math.min(natural,world.height*.55))),full];}
 function size(){if(!current)return;const {sheet,stop}=current;if(!mobile.matches){delete sheet.dataset.drawer;sheet.style.removeProperty('height');return;}sheet.dataset.drawer=['compact','peek','full'][stop];sheet.style.height=limits(sheet)[stop]+'px';}
 function attach(sheet,stop,change){current={sheet,stop,change};if(stop===0)sheet.scrollTop=0;sheet.classList.remove('drawer-dragging');size();const handle=sheet.querySelector('.grip');if(!handle)return;handle.setAttribute('aria-label',mobile.matches?['Expand place drawer to preview','Expand place drawer fully','Collapse place drawer'][stop]:'Toggle place details');handle.setAttribute('aria-expanded',stop>0?'true':'false');
 handle.addEventListener('pointerdown',e=>{if(!mobile.matches||e.button!==0)return;const heights=limits(sheet);gesture={y:e.clientY,height:sheet.getBoundingClientRect().height,heights,stop,moved:false,id:e.pointerId};handle.setPointerCapture(e.pointerId);});
 handle.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.id)return;const delta=gesture.y-e.clientY;if(Math.abs(delta)>5){gesture.moved=true;sheet.classList.add('drawer-dragging');sheet.dataset.drawer='peek';sheet.style.height=Math.max(gesture.heights[0],Math.min(gesture.heights[2],gesture.height+delta))+'px';}});
 const finish=(e,cancel=false)=>{if(!gesture||e.pointerId!==gesture.id)return;const g=gesture;gesture=null;sheet.classList.remove('drawer-dragging');if(!g.moved){size();return;}suppress=true;setTimeout(()=>suppress=false,350);if(cancel){size();return;}const delta=g.y-e.clientY,height=Math.max(g.heights[0],Math.min(g.heights[2],g.height+delta));let next=g.heights.reduce((best,h,i)=>Math.abs(h-height)<Math.abs(g.heights[best]-height)?i:best,0);if(next===g.stop&&Math.abs(delta)>28)next=Math.max(0,Math.min(2,g.stop+(delta>0?1:-1)));change(next);};
 handle.addEventListener('pointerup',e=>finish(e));handle.addEventListener('pointercancel',e=>finish(e,true));
 handle.addEventListener('keydown',e=>{if(!mobile.matches)return;let next;if(e.key==='ArrowUp')next=Math.min(2,stop+1);if(e.key==='ArrowDown')next=Math.max(0,stop-1);if(e.key==='Home')next=0;if(e.key==='End')next=2;if(next!==undefined){e.preventDefault();change(next);sheet.querySelector('.grip')?.focus({preventScroll:true});}});
 handle.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(suppress)return;change(mobile.matches?(stop+1)%3:(stop===2?1:2));});
 }
 window.addEventListener('resize',()=>{if(gesture){gesture=null;current?.sheet.classList.remove('drawer-dragging');}size();});mobile.addEventListener('change',size);
 return {attach,mobile:()=>mobile.matches};
})();
