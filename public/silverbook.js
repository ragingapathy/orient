'use strict';
// Reads Silverbook's people (read-only, via the server) so a place or calendar entry can note who you go
// there with. Never writes to Silverbook. If Silverbook isn't open, every place just works as it did before.
window.OrientSilverbook=(()=>{
  let api,cache={enabled:false,connected:false,people:[],message:''},loading=null,loadedAt=0;
  // enabled is false until the server says this installation uses Silverbook: nothing about it is drawn before then, or ever for most people.
  async function load(force=false){
    if(!force&&loadedAt&&Date.now()-loadedAt<60000)return cache;
    if(loading)return loading;
    let meta={};try{meta=JSON.parse(localStorage.getItem('orient-sync-v1')||'{}');}catch{}
    loading=fetch('/api/silverbook',{headers:meta.token?{Authorization:'Bearer '+meta.token}:{}}).then(async r=>{
      const data=await r.json().catch(()=>({}));
      // A non-200 here is Orient refusing the request (not paired through the tunnel yet), not Silverbook
      // being closed. Show that reason, not the generic one, so there's something to act on.
      // A refusal (401/403) only comes from a server that has the integration on, so it still counts as enabled.
      cache=r.ok
        ?{enabled:data.enabled!==false,connected:data.enabled!==false&&data.connected===true,people:data.enabled!==false&&Array.isArray(data.people)?data.people:[],message:String(data.message||'')}
        :{enabled:true,connected:false,people:[],message:String(data.error||'This browser isn’t allowed to read Silverbook.')};
      loadedAt=Date.now();
      return cache;
    }).catch(()=>{
      cache={enabled:cache.enabled,connected:false,people:[],message:'Could not reach Silverbook.'};
      loadedAt=Date.now();
      return cache;
    }).finally(()=>{loading=null;});
    return loading;
  }
  function data(){return cache;}
  function byId(){return new Map(cache.people.map(p=>[p.id,p]));}
  function chips(ids){if(!cache.enabled)return [];const map=byId();return (Array.isArray(ids)?ids:[]).map(id=>map.get(id)).filter(Boolean);}
  function init(a){api=a;load().then(()=>api?.render&&api.render());}
  return {load,data,chips,byId,init};
})();
