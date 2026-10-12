const assert=require('node:assert/strict'),S=require('./silverbook.cjs');
(async()=>{
 // Only id, name, address and city leave Silverbook. No notes, email, skills, or anything else.
 const state={people:[{id:'maya',name:'Maya Chen',address:'123 Main St',city:'Toledo',notes:'secret stuff',email:'maya@example.com',skills:[{name:'Python'}]},{id:'',name:'No id'},{id:'blank',name:''},{id:'oliver',name:'Oliver Brooks'}]};
 const list=await S.people(async()=>({ok:true,json:async()=>state}));
 assert.deepEqual(list,[{id:'maya',name:'Maya Chen',address:'123 Main St',city:'Toledo'},{id:'oliver',name:'Oliver Brooks',address:'',city:''}]);
 assert.equal(JSON.stringify(list).includes('secret'),false);
 assert.equal(JSON.stringify(list).includes('maya@example.com'),false);
 assert.equal(JSON.stringify(list).includes('Python'),false);
 await assert.rejects(()=>S.people(async()=>({ok:false})),/could not be read/i);

 // Only a local address is ever allowed.
 const old=process.env.ORIENT_SILVERBOOK_URL;
 try{process.env.ORIENT_SILVERBOOK_URL='https://remote.example';assert.throws(()=>S.config(),/local address/);}finally{if(old===undefined)delete process.env.ORIENT_SILVERBOOK_URL;else process.env.ORIENT_SILVERBOOK_URL=old;}

 // The route itself: GET only, and a graceful message instead of an error when Silverbook is unreachable.
 let status,body;const json=(res,s,d)=>{status=s;body=d;};
 await S.handle({method:'GET'},{},json,async()=>{throw new Error('ECONNREFUSED');});
 assert.equal(status,200);assert.equal(body.connected,false);assert.deepEqual(body.people,[]);assert.match(body.message,/Open Silverbook/);
 await S.handle({method:'GET'},{},json,async()=>({ok:true,json:async()=>({people:[{id:'oliver',name:'Oliver Brooks'}]})}));
 assert.equal(body.connected,true);assert.deepEqual(body.people,[{id:'oliver',name:'Oliver Brooks',address:'',city:''}]);
 let postStatus;await S.handle({method:'POST'},{writeHead:s=>postStatus=s,end:()=>{}},json);assert.equal(postStatus,405);

 // The integration is OFF unless this installation turns it on (the environment switch, or data/local-features.json), so
 // other people's installs never show it or look for it.
 {const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),keep={flag:process.env.ORIENT_SILVERBOOK,dir:process.env.ORIENT_DATA_DIR};
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'orient-features-')),file=path.join(tmp,'local-features.json');
  try{process.env.ORIENT_DATA_DIR=tmp;delete process.env.ORIENT_SILVERBOOK;
   assert.equal(S.enabled(),false,'off by default');
   process.env.ORIENT_SILVERBOOK='1';assert.equal(S.enabled(),true,'the environment switch turns it on');delete process.env.ORIENT_SILVERBOOK;
   fs.writeFileSync(file,'{"silverbook":true}');assert.equal(S.enabled(),true,'the local features file turns it on');
   fs.writeFileSync(file,'{"silverbook":"yes"}');assert.equal(S.enabled(),false,'only a real true counts');
   fs.writeFileSync(file,'not json');assert.equal(S.enabled(),false,'a broken file means off');
  }finally{for(const [k,v] of [['ORIENT_SILVERBOOK',keep.flag],['ORIENT_DATA_DIR',keep.dir]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}fs.rmSync(tmp,{recursive:true,force:true});}}

 console.log('Silverbook bridge: off by default (env switch or local features file only), minimal field projection (no notes, email or skills leave Silverbook), local-only address validation, GET-only route, and a graceful message when Silverbook is closed, all passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
