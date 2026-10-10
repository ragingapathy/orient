'use strict';
(function(root){
 const text=v=>String(v||'').replace(/coffee\s*shops?/gi,'coffee shop').replace(/thrift\s*stores?/gi,'thrift store').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
 const matches=(value,term)=>{const needle=text(term).replace(/s$/,'');return needle.length>1&&text(value).includes(needle);};
 const domains=[[/\b(sweaters?|shirts?|clothes|clothing|jeans|pants|thrift|secondhand)\b/i,['thrift','secondhand','second hand','clothing','clothes','sweater','resale','charity shop']], [/\b(comics?|books?|reading|bookstore)\b/i,['comic','book','library']], [/\b(coffee|cafe|café|espresso)\b/i,['coffee','cafe','café']], [/\b(tacos?|taqueria)\b/i,['taco','taqueria']], [/\b(park|parks|outdoors|walk|walking)\b/i,['park','public space','trail','garden']]];
 function find(records,plan,query=''){const domain=domains.map(([re,terms])=>({terms,index:text(query).search(re)})).filter(d=>d.index>=0).sort((a,b)=>a.index-b.index)[0]?.terms||[];return records.filter(p=>(!plan.openNow||p.open==='open')&&(!plan.unvisited||!p.visited)).map(p=>{const hay=p.name+' '+p.category+' '+p.note,terms=[...(plan.terms||[]),...domain],required=domain.length?domain:plan.mustMatch||[];if(required.length&&!required.some(t=>matches(hay,t)))return null;const score=terms.reduce((n,t)=>n+(matches(p.name,t)?5:matches(p.category,t)?4:matches(p.note,t)?2:0),0);if(terms.length&&!score&&!required.some(t=>matches(hay,t)))return null;return {...p,score:score+(p.rating>=4?1:0)-(p.rating&&p.rating<=2?3:0)};}).filter(Boolean).sort((a,b)=>b.score-a.score||(a.distance??Infinity)-(b.distance??Infinity)||a.name.localeCompare(b.name)).slice(0,5);}
 function draft(plan,record){if(plan.intent!=='update'||!record||plan.placeId!==record.id||!['hours','note','category'].includes(plan.field)||typeof plan.value!=='string'||!plan.value.trim())throw new Error('Choose a saved place and a specific detail.');const value=plan.value.trim();if(plan.field==='category'&&value.length>48)throw new Error('Use a category under 49 characters.');const before=String(record[plan.field]||''),after=plan.field==='note'?(before?before+'\n':'')+value:value;if(after.length>800)throw new Error('That note or hours entry would be too long. Shorten it first.');return {id:record.id,field:plan.field,before,after};}
 function groups(records,plan,query){const normalized=text(query),found=domains.map(([re,terms])=>({terms,index:normalized.search(re)})).filter(d=>d.index>=0).sort((a,b)=>a.index-b.index);if(found.length<2)return null;return found.map(d=>({label:d.terms[0]==='coffee'?'Coffee shops':d.terms[0]==='thrift'?'Thrift stores':d.terms[0]==='comic'?'Books & comics':d.terms[0]==='taco'?'Tacos':'Outdoors',places:find(records,{...plan,terms:d.terms,mustMatch:d.terms},d.terms[0])}));}
 function statusRequest(records,query,contextId=''){
  if(!/\b(open|closed|hours)\b/i.test(query)||/\b(tomorrow|tonight|yesterday|next|monday|tuesday|wednesday|thursday|friday|saturday|sunday|at \d)\b/i.test(query)||/\b(set|change|update|edit|add|save|record|remember)\b/i.test(query))return null;
  const normalize=v=>text(v).replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim(),q=normalize(query);
  const named=records.filter(p=>q.includes(normalize(p.name)));
  let candidates=named;
  if(!candidates.length){candidates=records.filter(p=>{const words=normalize(p.name).split(' ').filter(w=>w.length>2&&!['the','coffee','shop','store','cafe','and','bar','restaurant'].includes(w));return words.length&&words.every(w=>q.split(' ').includes(w));});}
  if(!candidates.length&&/\b(it|here|this place|they|their)\b/i.test(query))candidates=records.filter(p=>p.id===contextId);
  if(!candidates.length&&contextId&&/^(?:is (?:it )?open(?: now)?|what are (?:the )?hours|hours|open now)[? .]*$/i.test(query.trim()))candidates=records.filter(p=>p.id===contextId);
  if(candidates.length===1)return {place:candidates[0]};
  if(candidates.length>1)return {message:'Which place do you mean? Choose it in Place context and ask “Is it open now?”'};
  if(/^(?:is|are|what|when|does)\b/i.test(query)&&! /\b(places|shops|stores|anywhere|somewhere)\b/i.test(query))return {message:'I couldn’t identify that saved place. Choose it in Place context and ask “Is it open now?”'};
  return null;
 }
 const api={find,draft,groups,statusRequest};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OrientGidgitMap=api;
})(typeof window!=='undefined'?window:globalThis);
