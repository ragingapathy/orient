const assert=require('node:assert/strict'),{chromium}=require(process.env.ORIENT_PLAYWRIGHT||'playwright');
// Back on a phone closes the top modal (the way Esc does) instead of leaving Orient, and closing a modal any other way leaves no extra history behind.
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await p.route('**/api/state**',r=>r.fulfill({status:403,body:'{}'}));await p.addInitScript(()=>{localStorage.setItem('orient-weather-v1','{"show":false}');localStorage.setItem('orient-field-map-v1',JSON.stringify({version:1,home:{name:'Toledo',coordinates:[-83.539,41.655],timeZone:'America/New_York'},useCatalog:false,custom:[],saved:[],visited:[]}));});
const url=process.env.ORIENT_URL||'http://127.0.0.1:4173';await p.goto(url);await p.locator('.bottom-nav').waitFor();
const index=()=>p.evaluate(()=>navigation.currentEntry.index),open=id=>p.locator('#'+id).evaluate(d=>d.open),settle=()=>p.waitForTimeout(150);
const back=async()=>{await p.evaluate(()=>history.back());await settle();};
await p.evaluate(()=>{for(const id of ['back-a','back-b','back-busy']){const d=document.createElement('dialog');d.id=id;d.innerHTML='<p>'+id+'</p>';document.body.append(d);}document.getElementById('back-busy').addEventListener('cancel',e=>{if(window.busy)e.preventDefault();});});
const base=await index();

// a real dialog: Back closes it and Orient stays on the page
await p.evaluate(()=>document.getElementById('settings-dialog').showModal());await settle();assert.equal(await index(),base+1);
await back();assert.equal(await open('settings-dialog'),false);assert.equal(await index(),base);assert.equal(p.url().startsWith(url),true);assert.equal(await p.locator('.bottom-nav').isVisible(),true);

// stacked modals close one Back at a time, newest first
await p.evaluate(()=>document.getElementById('back-a').showModal());await settle();await p.evaluate(()=>document.getElementById('back-b').showModal());await settle();assert.equal(await index(),base+1);
await back();assert.equal(await open('back-b'),false);assert.equal(await open('back-a'),true);assert.equal(await index(),base+1);
await back();assert.equal(await open('back-a'),false);assert.equal(await index(),base);

// Opening order wins over DOM order, even when both open in the same task.
await p.evaluate(()=>{document.getElementById('back-b').showModal();document.getElementById('back-a').showModal();});await settle();
await back();assert.equal(await open('back-a'),false,'Back closes the foreground dialog');assert.equal(await open('back-b'),true);
await back();assert.equal(await open('back-b'),false);assert.equal(await index(),base);

// Reopening an underlying dialog moves it to the foreground.
await p.evaluate(()=>document.getElementById('back-a').showModal());await settle();
await p.evaluate(()=>document.getElementById('back-b').showModal());await settle();
await p.evaluate(()=>{const a=document.getElementById('back-a');a.close();a.showModal();});await settle();
await back();assert.equal(await open('back-a'),false);assert.equal(await open('back-b'),true);
await back();assert.equal(await open('back-b'),false);assert.equal(await index(),base);

// closing by button, Esc or swapping one modal for another never piles up history
for(let i=0;i<3;i++){await p.evaluate(()=>document.getElementById('back-a').showModal());await settle();await p.evaluate(()=>document.getElementById('back-a').close());await settle();}assert.equal(await index(),base);
await p.evaluate(()=>document.getElementById('back-a').showModal());await settle();await p.keyboard.press('Escape');await settle();assert.equal(await open('back-a'),false);assert.equal(await index(),base);
await p.evaluate(()=>{const a=document.getElementById('back-a');a.showModal();});await settle();await p.evaluate(()=>{document.getElementById('back-a').close();document.getElementById('back-b').showModal();});await settle();assert.equal(await index(),base+1);
await back();assert.equal(await open('back-b'),false);assert.equal(await index(),base);
// a modal that opens while our own Back is still landing gets its entry once it lands
await p.evaluate(()=>document.getElementById('back-a').showModal());await settle();await p.evaluate(async()=>{document.getElementById('back-a').close();await new Promise(r=>setTimeout(r));document.getElementById('back-b').showModal();});await settle();assert.equal(await open('back-b'),true);assert.equal(await index(),base+1);
await back();assert.equal(await open('back-b'),false);assert.equal(await index(),base);

// a modal that refuses to close while busy stays open, and Back still works once it is free
await p.evaluate(()=>{window.busy=true;document.getElementById('back-busy').showModal();});await settle();
await back();assert.equal(await open('back-busy'),true);assert.equal(await index(),base+1);
await p.evaluate(()=>{window.busy=false;});await back();assert.equal(await open('back-busy'),false);assert.equal(await index(),base);

// Older dialog implementations use the same cancel/close path.
await p.evaluate(()=>{document.getElementById('back-busy').requestClose=undefined;window.busy=true;document.getElementById('back-busy').showModal();});await settle();
await back();assert.equal(await open('back-busy'),true);assert.equal(await index(),base+1);
await p.evaluate(()=>{window.busy=false;});await back();assert.equal(await open('back-busy'),false);assert.equal(await index(),base);

// Non-modal dialogs do not intercept history, and detached modals leave no guard.
await p.evaluate(()=>document.getElementById('back-a').show());await settle();assert.equal(await index(),base);
await p.evaluate(()=>document.getElementById('back-a').close());await settle();
await p.evaluate(()=>{const d=document.createElement('dialog');d.id='back-removed';document.body.append(d);d.showModal();});await settle();assert.equal(await index(),base+1);
await p.evaluate(()=>document.getElementById('back-removed').remove());await settle();assert.equal(await index(),base);

// Back restores keyboard focus to the real opener.
const opener=p.getByRole('button',{name:'Open settings',exact:true});await opener.focus();await p.keyboard.press('Enter');await settle();
assert.equal(await p.evaluate(()=>document.getElementById('settings-dialog').contains(document.activeElement)),true);
await back();assert.equal(await open('settings-dialog'),false);assert.equal(await opener.evaluate(b=>b===document.activeElement),true);

// A reload or Forward traversal must not strand an unused modal history entry.
await p.evaluate(()=>document.getElementById('settings-dialog').showModal());await settle();
await p.reload();await p.locator('.bottom-nav').waitFor();await p.waitForFunction(i=>navigation.currentEntry.index===i,base);assert.equal(await open('settings-dialog'),false);
await p.evaluate(()=>history.forward());await p.waitForFunction(i=>navigation.currentEntry.index===i,base);await settle();assert.equal(await index(),base);

// With no modal, ordinary navigation still leaves Orient.
await p.route('**/modal-back-previous',r=>r.fulfill({contentType:'text/html',body:'<title>Previous page</title><p>Previous page</p>'}));
await p.goto(url+'/modal-back-previous');await p.goto(url);await p.locator('.bottom-nav').waitFor();
await p.evaluate(()=>document.getElementById('settings-dialog').showModal());await settle();await back();assert.equal(await open('settings-dialog'),false);
await p.evaluate(()=>history.back());await p.waitForURL('**/modal-back-previous');
console.log('Modal back: Back closes the top modal and stays in Orient, stacked modals close newest first, busy dialogs can refuse, and closing by button, Esc or swap leaves no extra history.');}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
