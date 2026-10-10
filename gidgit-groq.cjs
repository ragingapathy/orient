 'use strict';
// The cloud sees only the question, never the saved map or selected-place identity.
const model='openai/gpt-oss-20b';
const prompt=`Translate a private city-map question into a JSON search or edit plan. You have no map data. Never invent place facts. For find, supply useful search synonyms in terms and alternative main categories in mustMatch (cheap sweaters: thrift, secondhand, clothing, resale). Broad open/unvisited requests need empty terms. Set openNow only for right now, not future dates; unvisited only if asked. For update, only hours, note, category; value must be the new detail explicitly supplied by the user. Put the place name explicitly written in the question in placeId, or leave it empty for here/this place. Never invent an ID. Multiple different edits or unclear intent: clarify. No deletion, ratings, people, neighbors, visits or calendar edits. message is a brief clarification only. Return the JSON schema.`;
async function ask(request,{fetcher=fetch,signal,schema,validate}){
 const key=process.env.GROQ_API_KEY;
 if(!key)throw Object.assign(new Error('Groq needs a server API key. Add GROQ_API_KEY to the Orient environment first.'),{status:503});
 const res=await fetcher('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000),body:JSON.stringify({model,temperature:0,stream:false,max_completion_tokens:1024,reasoning_effort:'low',response_format:{type:'json_schema',json_schema:{name:'orient_plan',strict:true,schema}},messages:[{role:'system',content:prompt},{role:'user',content:request.query}]})});
 if(!res.ok){const status=res.status;throw Object.assign(new Error(status===429?'Groq’s free quota is busy or exhausted. Try later or select Ollama.':status===401||status===403?'Groq rejected the server API key. Check the key and account permissions.':'Groq is unavailable (HTTP '+status+'). Your map is unchanged.'),{status:status===429?429:502});}
 let data,parsed;try{data=await res.json();parsed=JSON.parse(data.choices?.[0]?.message?.content);}catch{throw new Error('Groq returned an unreadable answer. Your map is unchanged.');}
 if(parsed.intent==='update'){
  const normalize=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  const target=normalize(parsed.placeId),q=normalize(request.query);
  const matches=target&&q.includes(target)?request.places.filter(p=>normalize(p.name)===target):[];
  const selected=!target?request.places.find(p=>p.id===request.contextPlaceId):null;
  const place=matches.length===1?matches[0]:selected;
  if(!place)parsed={intent:'clarify',message:'Choose the place in Place context, then ask me to remember that detail.'};else parsed.placeId=place.id;
 }
 const plan=validate(parsed,request.places);
 if(plan.intent==='find'){
  plan.openNow=plan.openNow&&/\b(open now|open right now|currently open|open at the moment|somewhere open|places open)\b/i.test(request.query)&&!/\b(not|aren.t|isn.t) open\b/i.test(request.query);
  plan.unvisited=plan.unvisited&&/\b(unvisited|haven.t (?:been|visited|tried)|never (?:been|visited|tried)|not visited|new to me)\b/i.test(request.query);
 }
 return {plan,engine:{provider:'Groq',model},coverage:{included:0,total:request.total},privacy:'question-only'};
}
module.exports={ask,model};
