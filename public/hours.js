/* Conservative weekly hours: unsupported or ambiguous text never becomes “open”. */
'use strict';
(function(root){
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],names={mo:0,mon:0,monday:0,tu:1,tue:1,tues:1,tuesday:1,we:2,wed:2,wednesday:2,th:3,thu:3,thur:3,thurs:3,thursday:3,fr:4,fri:4,friday:4,sa:5,sat:5,saturday:5,su:6,sun:6,sunday:6},cache=new Map();
  function daySet(s){s=s.trim().toLowerCase().replace(/\./g,'').replace(/\b(mon|tue|wed|thu|fri|sat|sun)(?:days)?s\b/g,'$1').replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s\b/g,'$1').replace(/\band\b/g,',').replace(/\s*[&/]\s*/g,',');if(/^(daily|every day|everyday|all days)$/.test(s))return [0,1,2,3,4,5,6];if(s==='weekdays')return [0,1,2,3,4];if(s==='weekends')return [5,6];const out=[];for(const part of s.split(',')){const range=part.trim().split(/\s*-\s*/);if(range.length>2||range.some(v=>names[v]===undefined))return null;let d=names[range[0]],end=names[range.at(-1)];out.push(d);while(d!==end){d=(d+1)%7;out.push(d);}}return [...new Set(out)];}
  function clock(s,allow24=false){s=s.trim().toLowerCase();if(s==='noon')return 720;if(s==='midnight')return 0;const m=/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(s);if(!m)return null;let h=+m[1],min=+(m[2]||0);if(min>59)return null;if(m[3]){if(h<1||h>12)return null;h=h%12+(m[3]==='pm'?12:0);}else {if(!m[2])return null;if(h>23&&!(allow24&&h===24&&min===0))return null;}return h*60+min;}
  const format=n=>n===1440?'12:00 am':(Math.floor(n/60)%12||12)+':'+String(n%60).padStart(2,'0')+(n<720?' am':' pm');
  function intervals(s){if(/^(closed|off)$/i.test(s))return [];if(/^(24\/7|24 hours|open 24 hours)$/i.test(s))return [[0,1440]];const result=[];for(let part of s.replace(/\s+and\s+/gi,',').split(/\s*[,\/]\s*/)){let halves=part.trim().split(/\s*-\s*/);if(halves.length!==2)return null; // Bare 9-5 is ambiguous; require am/pm or 24-hour notation.
      const suffix=halves[1].match(/(am|pm)$/i)?.[1];if(suffix&&/^\d{1,2}(?::\d{2})?$/.test(halves[0])){const a=+halves[0].split(':')[0],b=+halves[1].match(/^\d+/)[0];halves[0]+=' '+(suffix.toLowerCase()==='pm'&&a>b&&a!==12?'am':suffix.toLowerCase()==='am'&&a>b&&a!==12?'pm':suffix);}
      const a=clock(halves[0]),b=clock(halves[1],true);if(a===null||b===null||a===b||a===1440)return null;result.push([a,b]);}return result.sort((a,b)=>a[0]-b[0]);}
  const dayToken='(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues|tue|wed|thurs|thur|thu|fri|sat|sun|mo|tu|we|th|fr|sa|su)';
  function prepare(raw){
    let s=raw.normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\r\n?/g,'\n').replace(/[−–—~]/g,'-').replace(/[•|]/g,';').replace(/\b(a|p)\s*\.?\s*m\.?(?![a-z])/gi,'$1m').replace(/\b(to|through|until)\b/gi,'-').replace(/^\s*(?:business |opening |store )?hours\s*:?\s*/i,'').trim();
    s=s.replace(new RegExp('(^|[;\\n])[^;\\n]+?:\\s*(?='+dayToken+'\\b)','gi'),'$1');
    s=s.replace(new RegExp('('+dayToken+')(?=\\d)','gi'),'$1 ');
    // Copied tables often place the weekday and its times on separate lines.
    s=s.replace(new RegExp('(^|[;\\n])\\s*('+dayToken+')\\s*\\n\\s*(?=\\d|closed|off|noon|midnight)','gi'),'$1$2 ');
    // A comma separates shifts unless the following token begins another day rule.
    s=s.replace(new RegExp('((?:am|pm|noon|midnight|[0-9]|closed|off)),\\s*(?='+dayToken+'s?\\b|weekdays?\\b|weekends?\\b|daily\\b|closed\\b)','gi'),'$1; ');
    s=s.replace(/\bclosed\s+(?:on\s+)?([^;\n]+)/gi,(_,d)=>d.trim()+' closed');
    return s;
  }
  const dates=()=>typeof module!=='undefined'&&module.exports?require('./calendar-dates.js'):root.OrientDates;
  const ordinalNames={'1':'1st','2':'2nd','3':'3rd','4':'4th','5':'5th','-1':'Last'};
  function monthlyDays(value){
    const s=String(value).toLowerCase().trim().replace(/^every\s+/,'').replace(/\s+(?:of )?(?:each|every|the) month$/,'').replace(/\b(first|second|third|fourth|fifth|last)\b/g,w=>({first:'1st',second:'2nd',third:'3rd',fourth:'4th',fifth:'5th',last:'-1st'}[w]));
    const m=new RegExp('^(.+?)\\s+('+dayToken+')s?$', 'i').exec(s);if(!m)return null;const nums=m[1].split(/\s*(?:,|&|and)\s*/).filter(Boolean);if(!nums.length||nums.some(n=>! /^(?:[1-5](?:st|nd|rd|th)|-1st)$/.test(n)))return null;
    const wd=['MO','TU','WE','TH','FR','SA','SU'][names[m[2]]];return [...new Set(nums.map(n=>parseInt(n)+wd))];
  }
  function monthlyIn(sentence){const ordinal='(?:first|second|third|fourth|fifth|last|[1-5](?:st|nd|rd|th))',re=new RegExp('(?:every\\s+)?'+ordinal+'(?:\\s*(?:,|&|and)\\s*'+ordinal+')*\\s+'+dayToken+'s?\\b','gi'),matches=[...String(sentence).matchAll(re)];return matches.length?[...new Set(matches.flatMap(m=>monthlyDays(m[0])||[]))]:null;}
  function monthlyLabel(byday){return byday.map(v=>{const m=/^(-?\d)(MO|TU|WE|TH|FR|SA|SU)$/.exec(v);return m?ordinalNames[m[1]]+' '+days[['MO','TU','WE','TH','FR','SA','SU'].indexOf(m[2])]:'';}).filter(Boolean).join('; ');}
  function parse(raw){raw=String(raw||'').trim();if(cache.has(raw))return cache.get(raw);const week=Array(7).fill(null),rules=[],errors=[];let input=prepare(raw);if(/^(24\/7|24 hours|open 24 hours)$/i.test(input))input='Daily 00:00-24:00';
    // Separate consecutive timed clauses, including mixed weekly/monthly service windows.
    input=input.replace(new RegExp('((?:am|pm|noon|midnight|[0-9]|closed|off))[, ]+(?=(?:[1-5](?:st|nd|rd|th)|first|second|third|fourth|fifth|last)\\b)','gi'),'$1; ');
    for(const line of input.split(/[;\n]+/).map(s=>s.trim()).filter(Boolean)){
      const m=/^(.+?)(?::\s*|\s+)(closed|off|24\/7|(?:open )?24 hours|\d.*|noon.*|midnight.*)$/i.exec(line);
      let prefix=m&&m[1].replace(/[:,]$/,''),ds=prefix&&daySet(prefix),monthly=prefix&&monthlyDays(prefix),spans=m&&intervals(m[2]);
      if((!ds&&!monthly)||spans===null){for(const gap of line.matchAll(/\s+/g)){const head=line.slice(0,gap.index).replace(/[:,]$/,'').trim(),wd=daySet(head),mr=monthlyDays(head),times=intervals(line.slice(gap.index+gap[0].length).trim());if((wd||mr)&&times!==null){ds=wd;monthly=mr;spans=times;break;}}}
      if((!ds&&!monthly)||spans===null){for(const gap of line.matchAll(/\s+/g)){const suffix=line.slice(gap.index+gap[0].length).trim(),tail=daySet(suffix),mr=monthlyDays(suffix),times=intervals(line.slice(0,gap.index).trim());if((tail||mr)&&times!==null){ds=tail;monthly=mr;spans=times;break;}}}
      if((!ds&&!monthly)||spans===null||rules.length>=40){errors.push(line);continue;}
      if(monthly){if(!spans.length||rules.some(r=>r.byday.some(d=>monthly.includes(d))&&r.spans.some(([a,b])=>spans.some(([c,d])=>a===c&&b===d)))){errors.push(line);continue;}rules.push({freq:'MONTHLY',interval:1,byday:monthly,spans});}
      else for(const d of ds){if(week[d]!==null){errors.push(line);break;}week[d]=spans;}
    }
    const known=week.filter(v=>v!==null).length,valid=(known>0||rules.length>0)&&!errors.length;
    const spanText=v=>!v.length?'Closed':v.map(([a,b])=>a===0&&b===1440?'24 hours':format(a)+' – '+format(b)).join(', ');
    const normalized=valid?[...week.map((v,i)=>v===null?'':days[i]+': '+spanText(v)).filter(Boolean),...rules.flatMap(r=>r.byday.map(d=>monthlyLabel([d])+': '+spanText(r.spans)))].join('\n'):raw;
    const value={valid,week,rules,normalized,errors,known,monthly:rules.length>0};if(cache.size>600)cache.clear();cache.set(raw,value);return value;
  }
  function spansOn(schedule,date){const D=dates(),day=(new Date(date+'T12:00:00Z').getUTCDay()+6)%7,out=[...(schedule.week[day]||[])];for(const r of schedule.rules||[]){if(D.expandRule(r,date.slice(0,7)+'-01',date,date).length)out.push(...r.spans);}return out;}
  function serviceEvents(raw,placeId,name){const s=parse(raw);if(!s.valid||!s.monthly)return [];return [...s.rules,...s.week.flatMap((spans,i)=>spans?.length?[{freq:'WEEKLY',interval:1,byday:[['MO','TU','WE','TH','FR','SA','SU'][i]],spans}]:[])].flatMap((r,i)=>r.spans.map(([start,end],j)=>({id:'hours-'+placeId+'-'+i+'-'+j,placeId,title:name+' · Service hours',date:'2000-01-01',time:String(Math.floor(start/60)).padStart(2,'0')+':'+String(start%60).padStart(2,'0'),end:'',repeat:r.freq.toLowerCase(),interval:1,days:r.byday,rule:{freq:r.freq,interval:1,byday:r.byday},duration:end>start?end-start:1440-start+end,kind:'Service hours',note:'Derived from place hours. Edit the hours on the place card. Holiday exceptions are not confirmed.',skip:[],hoursSource:true})));}
  function status(raw,now=new Date(),timeZone='America/New_York'){const schedule=parse(raw);if(!schedule.valid)return {state:'unknown',label:'Hours need review',schedule};let parts;try{parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);}catch{return {state:'unknown',label:'Hours unknown',schedule};}const get=k=>parts.find(p=>p.type===k)?.value,day=days.indexOf(get('weekday')),minute=+get('hour')*60+ +get('minute'),date=get('year')+'-'+get('month')+'-'+get('day'),today=schedule.monthly?spansOn(schedule,date):schedule.week[day],yesterday=schedule.monthly?spansOn(schedule,dates().fromNum(dates().toNum(date)-1)):schedule.week[(day+6)%7];
    const late=yesterday?.find(([a,b])=>b<a&&minute<b);const span=today?.find(([a,b])=>b>a?minute>=a&&minute<b:minute>=a);if(late||span){const end=(late||span)[1];return {state:'open',label:span?.[0]===0&&end===1440?'Open now · 24 hours':'Open now · Until '+format(end),schedule};}
    if(today===null||yesterday===null&&minute<(today?.[0]?.[0]??1440))return {state:'unknown',label:'Hours unknown for this time',schedule};return {state:'closed',label:'Closed now',schedule};}
  const api={parse,status,format,monthlyDays,monthlyIn,monthlyLabel,serviceEvents};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OrientHours=api;
})(typeof window!=='undefined'?window:globalThis);
