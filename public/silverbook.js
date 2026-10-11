'use strict';
// Reads Silverbook's people (read-only, via the server) so a place or calendar entry can note who you go
// there with. Never writes to Silverbook. If Silverbook isn't open, every place just works as it did before.
window.OrientSilverbook=(()=>{
  let api,cache={connected:false,people:[],message:''},loading=null,loadedAt=0;
  async function load(force=false){
    if(!force&&loadedAt&&Date.now()-loadedAt<60000)return cache;
    if(loading)return loading;
    loading=fetch('/api/silverbook').then(r=>r.json()).then(data=>{
      cache={connected:data.connected===true,people:Array.isArray(data.people)?data.people:[],message:String(data.message||'')};
      loadedAt=Date.now();
      return cache;
    }).catch(()=>{
      cache={connected:false,people:[],message:'Could not reach Silverbook.'};
      loadedAt=Date.now();
      return cache;
    }).finally(()=>{loading=null;});
    return loading;
  }
  function data(){return cache;}
  function byId(){return new Map(cache.people.map(p=>[p.id,p]));}
  function chips(ids){const map=byId();return (Array.isArray(ids)?ids:[]).map(id=>map.get(id)).filter(Boolean);}
  function init(a){api=a;load().then(()=>api?.render&&api.render());}
  return {load,data,chips,byId,init};
})();
