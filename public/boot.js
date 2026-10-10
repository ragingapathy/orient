'use strict';
// A new map does not download the owner's private catalog or Toledo examples.
window.OrientCatalog=(()=>{
  const catalog=[];window.ORIENT_CATALOG=catalog;let loaded=false,promise;
  const legacy=raw=>raw?.version===1&&!Object.prototype.hasOwnProperty.call(raw,'home');
  const needed=raw=>raw?.useCatalog||legacy(raw)||[...(raw?.saved||[]),...(raw?.visited||[])].some(id=>typeof id==='string'&&!/^(local-|osm-|tile-)/.test(id));
  const script=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s);});
  async function load(){if(loaded)return;if(promise)return promise;promise=(async()=>{
    try{await script('./catalog.local.js');}catch{}
    if(window.ORIENT_CATALOG===catalog){window.ORIENT_CATALOG=null;try{await script('./catalog.sample.js');}catch{}}
    const result=Array.isArray(window.ORIENT_CATALOG)?[...window.ORIENT_CATALOG]:[];catalog.splice(0,catalog.length,...result);window.ORIENT_CATALOG=catalog;loaded=true;
  })();return promise;}
  return {load,legacy,needed};
})();
(async()=>{try{const raw=JSON.parse(localStorage.getItem('orient-field-map-v1')||'null');if(OrientCatalog.needed(raw))await OrientCatalog.load();}catch{}const s=document.createElement('script');s.src='./app.js?v=20261009-explorehome1';document.head.append(s);})();
