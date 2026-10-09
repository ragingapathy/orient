const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.ORIENT_PLAYWRIGHT||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/state**',route=>route.fulfill({status:403,contentType:'application/json',body:'{"error":"Isolated test"}'}));
    await page.goto(process.env.ORIENT_URL||'http://127.0.0.1:4173');
    await page.waitForFunction(()=>window.OrientOutings);
    const report=await page.evaluate(()=>{
      const p=(id,kind,coordinates=[-83.539,41.655])=>({id,name:id,kind,coordinates});
      const places=[p('saved-comics','Comic shop'),p('cafe','Coffee shop'),p('park','Public spaces'),p('pantry','Food pantry'),p('mechanic','Auto'),p('far','Comic shop',[-84.5,42.5]),p('bad','Book shop'),{...p('demo','Comic shop'),demo:true}];
      const store={saved:['saved-comics'],visited:[],ratings:{bad:1}},origin=[-83.539,41.655],options={minutes:'45',budget:'10',mode:'walking',social:'solo'};
      const ids=o=>OrientOutings.suggest(places,store,origin,{...options,...o}).map(c=>c.p.id);
      return {normal:ids({}),free:ids({budget:'0'}),short:ids({minutes:'10'}),social:OrientOutings.suggest(places,{saved:[],visited:[],ratings:{bad:1}},origin,{...options,social:'company'}).map(c=>c.p.id)};
    });
    assert.equal(report.normal[0],'saved-comics');assert.deepEqual(report.free,['park']);assert.deepEqual(report.short,[]);assert.equal(report.social[0],'cafe');
    const calendar=await page.evaluate(()=>{
      const places=['comics','cafe','park'].map((id,i)=>({id,name:id,kind:['Comic shop','Coffee shop','Public spaces'][i],coordinates:[-83.539,41.655]}));
      const store={saved:['comics'],visited:[],ratings:{}},options={minutes:'45',budget:'10',mode:'walking',social:'company'};
      const rank=entries=>OrientOutings.suggest(places,store,[-83.539,41.655],options,entries,720);
      const entry={placeId:'cafe',title:'Lunch special',kind:'Special',date:'2026-10-09',time:'12:00',endTime:'13:00'};
      return {boost:rank([entry])[0].p.id,reason:rank([entry])[0].reason.title,expired:rank([{...entry,endTime:'11:00'}]).some(c=>c.reason),late:rank([{...entry,time:'18:00',endTime:'19:00'}]).some(c=>c.reason),free:OrientOutings.suggest(places,store,[-83.539,41.655],{...options,budget:'0'},[entry],720).map(c=>c.p.id)};
    });
    assert.equal(calendar.boost,'cafe');assert.equal(calendar.reason,'Lunch special');assert.equal(calendar.expired,false);assert.equal(calendar.late,false);assert.deepEqual(calendar.free,['park']);
    await page.evaluate(()=>{
      const date=OrientCalendar.today();localStorage.setItem('orient-field-map-v1',JSON.stringify({version:1,showDemo:false,custom:[{id:'local-timely',name:'Calendar fixture comics',kind:'Comic shop',coordinates:[-83.539,41.655]}],saved:['local-timely'],visited:[],events:[{id:'fixture-new-comics',placeId:'local-timely',title:'New comic day fixture',kind:'Special',date,time:'',end:'',repeat:'daily',interval:1,days:[],skip:[]},{id:'fixture-skipped',placeId:'local-timely',title:'Skipped fixture',kind:'Special',date,time:'',end:'',repeat:'daily',interval:1,days:[],skip:[date]}]}));
    });
    await page.reload();
    await page.getByRole('button',{name:'Today',exact:true}).click();
    await page.locator('[data-outing-open]').click();
    const dialog=page.locator('#outing-dialog');await dialog.waitFor({state:'visible'});
    assert.match(await dialog.innerText(),/not your GPS location/);
    assert.match(await dialog.innerText(),/New comic day fixture/);assert.doesNotMatch(await dialog.innerText(),/Skipped fixture/);
    await page.locator('[data-outing-pref="mode"]').selectOption('driving');
    const directions=dialog.locator('a[data-dir]');if(await directions.count())assert.equal(await directions.first().getAttribute('data-mode'),'driving');
    await page.locator('[data-outing-pref="budget"]').selectOption('0');
    assert.match(await page.locator('#outing-budget-note').innerText(),/No-spend/);
    await page.screenshot({path:'output/playwright/outings-mobile.png'});
    assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    await page.setViewportSize({width:320,height:740});assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);await page.setViewportSize({width:390,height:844});
    await page.locator('[data-outing-close]').click();await page.locator('[data-outing-open]').click();
    assert.equal(await page.locator('[data-outing-pref="budget"]').inputValue(),'0');
    await page.locator('[data-outing-pref="budget"]').selectOption('10');
    await page.locator('[data-outing-pref="minutes"]').selectOption('90');
    await page.screenshot({path:'output/playwright/outings-mobile-results.png'});
    const placeButton=page.locator('[data-outing-place]').first();if(await placeButton.count()){await placeButton.click();assert.equal(await dialog.isVisible(),false);assert.equal(await page.locator('#sheet').isVisible(),true);}
    await page.reload();await page.getByRole('button',{name:'Today',exact:true}).click();await page.locator('[data-outing-open]').click();assert.equal(await page.locator('[data-outing-pref="minutes"]').inputValue(),'45');
    await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'output/playwright/outings-desktop.png'});
    assert.deepEqual(errors,[]);console.log('Outings: constraints, ranking, mobile layout, navigation, directions and session-only preferences passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
