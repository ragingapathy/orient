/* Low-resolution, slowly advected mist. The parent mask keeps familiar places clear. */
'use strict';
window.OrientFog=(()=>{
  const host=document.querySelector('#fog'),canvas=document.createElement('canvas');
  host.append(canvas);const ctx=canvas.getContext('2d',{alpha:true});
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let active=false,frame=0,last=0,clock=0,width=1,height=1;
  // Deterministic wisps avoid a flash of changing texture when toggling the fog.
  const wisps=Array.from({length:24},(_,i)=>({x:((i*0.618034)%1)*1.5-.25,y:((i*0.414214)%1)*1.5-.25,r:.12+(i%5)*.03,phase:i*2.39996,vx:0,vy:0}));
  function resize(){const rect=host.getBoundingClientRect();width=Math.max(1,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));const scale=Math.min(.45,480/Math.max(width,height));canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));paint(0);}
  function paint(dt){if(!ctx)return;const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);clock+=dt;
    for(const p of wisps){if(dt){const cx=.5+.19*Math.sin(clock*.12+p.phase*.08),cy=.5+.17*Math.cos(clock*.1+p.phase*.07),dx=p.x-cx,dy=p.y-cy,fall=1/(1+5*(dx*dx+dy*dy));
      // A damped curl field: tangential drift around moving eddies, with a gentle crosswind.
      const vx=-dy*.07*fall+.014+Math.sin(p.y*7+clock*.2)*.003,vy=dx*.07*fall+Math.cos(p.x*6-clock*.16)*.003;
      const blend=1-Math.exp(-dt*.7);p.vx+=(vx-p.vx)*blend;p.vy+=(vy-p.vy)*blend;p.x+=p.vx*dt;p.y+=p.vy*dt;
      if(p.x>1.35)p.x=-.35;if(p.x<-.35)p.x=1.35;if(p.y>1.35)p.y=-.35;if(p.y<-.35)p.y=1.35;
    }
    const x=(p.x+Math.sin(clock*.14+p.phase)*.025)*w,y=(p.y+Math.cos(clock*.12+p.phase)*.025)*h,r=p.r*Math.max(w,h),g=ctx.createRadialGradient(x,y,0,x,y,r);
    const light=p.phase%3>1;g.addColorStop(0,light?'rgba(255,255,238,.75)':'rgba(65,101,83,.46)');g.addColorStop(.45,light?'rgba(242,249,224,.4)':'rgba(100,137,111,.24)');g.addColorStop(1,'rgba(220,231,213,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
  }
  function tick(now){frame=0;if(!active||document.hidden||motion.matches)return;if(now-last>=50){const dt=last?Math.min((now-last)/1000,.1):0;last=now;paint(dt);}frame=requestAnimationFrame(tick);}
  function sync(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;if(active&&!document.hidden&&!motion.matches)frame=requestAnimationFrame(tick);else if(active)paint(0);}
  function setActive(value){if(active===value)return;active=value;if(active)resize();sync();}
  motion.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);new ResizeObserver(()=>{if(active)resize();}).observe(host);
  return {setActive,get active(){return active;},get animating(){return !!frame;}};
})();
