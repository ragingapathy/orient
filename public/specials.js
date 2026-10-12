'use strict';
window.OrientSpecials=(()=>{
 const names=['sun','mon','tue','wed','thu','fri','sat'],codes=['SU','MO','TU','WE','TH','FR','SA'];
 const day='(?:sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)s?';
 const offer=/\$\s*\d|\d\s*[¢%]|\b(?:half[ -]price|half off|\d\s*\/\s*2\s*price|special|discount|happy hour|free|two.for.one|2.for.1)\b/i;
 function parse(note){const text=String(note||''),re=new RegExp('\\b('+day+'(?:\\s*(?:-|–|&|and|,|/)\\s*'+day+')*)\\s*:', 'gi'),marks=[...text.matchAll(re)],out=[];
 for(let i=0;i<marks.length;i++){const m=marks[i],body=text.slice(m.index+m[0].length,marks[i+1]?.index??text.length).trim().replace(/[.;\s]+$/,'');if(!body||!offer.test(body))continue;const ds=[...m[1].matchAll(new RegExp(day,'gi'))].map(x=>names.indexOf(x[0].slice(0,3).toLowerCase()));let days=ds;if(/[-–]/.test(m[1])&&ds.length===2){days=[];for(let d=ds[0],n=0;n<7;n++,d=(d+1)%7){days.push(d);if(d===ds[1])break;}}const clocks=window.OrientCalendar?.parse(body)||{};out.push({title:body.slice(0,140),repeat:'weekly',days:[...new Set(days)].map(d=>codes[d]),time:clocks.time||'',end:clocks.end||''});}
 return out;}
 function apply(p,details){const raw=details&&Object.hasOwn(details,'note')?details.note:undefined,original=String(p.note||'');if(raw===undefined)return p.id.startsWith('local-')?{...p,specials:parse(original),personalSpecials:true}:p;if(String(raw)===original)return p;const note=String(raw),parsed=parse(note),schedule=new RegExp('\\b'+day+'\\s*:','i').test(note);if(parsed.length||schedule||!note.trim()||/\b(?:no longer|stopped|discontinued|ended)\b.*\bspecials?\b|\bspecials?\b.*\b(?:stopped|discontinued|ended)\b/i.test(note))return {...p,note,specials:parsed,personalSpecials:true};return p;}
 return {parse,apply};
})();
