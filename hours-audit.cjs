// Read-only audit: no AI calls, network requests, or saved-data changes.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),H=require('./public/hours.js');
const filename=process.argv.find(a=>a.endsWith('.json'))||path.join(__dirname,'data/orient-state.json');
const raw=JSON.parse(fs.readFileSync(filename,'utf8')),state=raw.state||raw,records=[...(state.custom||[]),...(state.osm||[])];
const catalog=path.join(__dirname,'public/catalog.local.js');if(state.useCatalog&&fs.existsSync(catalog)){const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(catalog,'utf8'),sandbox,{timeout:1000});records.push(...(sandbox.window.ORIENT_CATALOG||[]));}
const rows=[];for(const p of new Map(records.map(p=>[p.id,p])).values()){const hours=state.details?.[p.id]?.hours||(state.web?.profiles?.[p.id]||[]).filter(f=>f.key==='hours').map(f=>f.value).join('; ')||p.hours||'';if(!hours.trim())continue;const parsed=H.parse(hours);rows.push({name:p.name,valid:parsed.valid,hours,unrecognized:parsed.errors});}
const unsupported=rows.filter(r=>!r.valid);console.log(JSON.stringify({checked:rows.length,recognized:rows.length-unsupported.length,needsReview:unsupported.length,...(process.argv.includes('--details')?{unsupported}: {})},null,2));
