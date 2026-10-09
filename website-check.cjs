const assert=require('node:assert/strict');
const W=require('./website.cjs');
const site='https://venue.example/';
const html='<html><script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'ComicStore',name:'Real Comics',telephone:'419-555-0100',address:{streetAddress:'123 Main St',addressLocality:'Toledo'},openingHoursSpecification:[{dayOfWeek:['https://schema.org/Wednesday'],opens:'10:00',closes:'19:00'}]},{'@type':'Event',name:'New comic meetup',startDate:'2026-10-14T19:00:00-04:00',endDate:'2026-10-14T21:00:00-04:00',location:{name:'Real Comics'}}]})+'</script><a href="/contact">Contact</a><a href="/events.ics">Subscribe calendar</a><a href="tel:419-555-0123">Call</a><p>Wednesday hours 10am–7pm</p></html>';
const ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:comics\r\nDTSTART;TZID=America/New_York:20261014T190000\r\nDTEND;TZID=America/New_York:20261014T210000\r\nRRULE:FREQ=WEEKLY;BYDAY=WE;COUNT=3\r\nEXDATE;TZID=America/New_York:20261021T190000\r\nSUMMARY:New comic meetup\r\nLOCATION:Real Comics\r\nEND:VEVENT\r\nEND:VCALENDAR';
(async()=>{
 const now=Date.now;Date.now=()=>Date.parse('2026-10-08T12:00:00Z');
 try{
 const read=[];const reader=async url=>{read.push(url);if(url.endsWith('/robots.txt'))return {url,body:'User-agent: *\nAllow: /',type:'text/plain'};if(url.endsWith('.ics'))return {url,body:ics,type:'text/calendar'};if(url.endsWith('/contact'))return {url,body:'<html><a href="tel:419-555-0999">Call</a></html>',type:'text/html'};return {url,body:html,type:'text/html'};};
 const r=await W.inspectWith(site,{reader});
 assert.equal(r.calendars[0].url,site+'events.ics');assert.equal(r.events[0].time,'19:00');assert.equal(r.events[0].end,'21:00');
 assert.ok(r.facts.some(f=>f.key==='name'&&f.value==='Real Comics'));
 assert.ok(r.facts.some(f=>f.key==='phone'&&f.value==='419-555-0999'));
 assert.ok(r.facts.some(f=>f.key==='hours'&&f.method.includes('excerpt')));
 assert.ok(!read.includes(site+'events.ics'),'Linked feeds are read only on explicit preview');
 const feed=await W.inspectWith(site+'events.ics',{reader});assert.deepEqual(feed.events.map(e=>e.date),['2026-10-14','2026-10-28']);assert.equal(feed.isFeed,true);
 assert.ok(!W.robotsAllows('User-agent: *\nDisallow: /private','/private/events'));
 assert.ok(W.robotsAllows('User-agent: *\nDisallow: /private\nAllow: /private/public','/private/public/events'));
 await assert.rejects(()=>W.inspectWith(site,{reader:async url=>({url,type:'text/plain',body:'User-agent: *\nDisallow: /'})}),/asks automated readers/);
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.1.1','192.168.1.1','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:0000::1','2001:db8::1','2002:7f00:1::1'])assert.equal(W.publicIP(ip),false,ip);
 assert.equal(W.publicIP('8.8.8.8'),true);assert.equal(W.publicIP('2606:4700:4700::1111'),true);
 assert.throws(()=>W.normalize('file:///C:/secret'),/public/);assert.throws(()=>W.normalize('https://user:pass@venue.example/'),/public/);
 console.log('PASS: website facts, text candidates, linked contact pages, feed discovery without auto-fetch, ICS recurrence/timezones/exceptions, robots rules, public-network guards.');
 }finally{Date.now=now;}
})().catch(e=>{console.error(e);process.exit(1)});
