const assert=require('node:assert/strict'),H=require('./public/hours.js');
const at=(text,instant,zone='America/New_York')=>H.status(text,new Date(instant),zone).state;
const weekly='Mon-Fri 9am-5pm; Sat 10am-2pm; Sun closed';
assert.equal(H.parse(weekly).valid,true);assert.equal(H.parse(H.parse(weekly).normalized).normalized,H.parse(weekly).normalized);
assert.equal(at(weekly,'2026-10-09T13:00:00Z'),'open');assert.equal(at(weekly,'2026-10-09T21:00:00Z'),'closed');
assert.equal(at('Daily 09:00-17:00','2026-10-09T13:30:00Z','America/Chicago'),'closed');
assert.equal(at('Daily 09:00-17:00','2026-10-09T14:00:00Z','America/Chicago'),'open');
assert.equal(at('Fri 9-1am; Sat closed','2026-10-10T04:30:00Z'),'open');
assert.equal(at('Fri 8pm-2am; Sat closed','2026-10-10T05:00:00Z'),'open');assert.equal(at('Fri 8pm-2am; Sat closed','2026-10-10T06:00:00Z'),'closed');
assert.equal(at('Daily 9am-noon, 2pm-5pm','2026-10-09T17:00:00Z'),'closed');assert.equal(at('Daily 9am-noon, 2pm-5pm','2026-10-09T18:00:00Z'),'open');
assert.equal(H.parse(H.parse('24/7').normalized).valid,true);assert.equal(H.parse('Mon-Fri:9am-5pm').valid,true);
for(const text of ['24/7','Daily 00:00-24:00','Weekdays 9-5pm; Weekends closed','Mo-Fr 09:00-17:00; Sa,Su off'])assert.equal(H.parse(text).valid,true,text);
for(const text of ['Mon-Fri 9-5','Daily 25:00-29:00','Daily 9am-5pm; PH off','By appointment','Mon 9am-5pm; Mon closed','Daily 13pm-5pm','Mon-Fri 9:75-17:00']){assert.equal(H.parse(text).valid,false,text);assert.equal(at(text,'2026-10-09T16:00:00Z'),'unknown');}
assert.equal(at('Mon 9am-5pm','2026-10-09T16:00:00Z'),'unknown');assert.equal(at('Sun 1am-3am','2026-11-01T06:30:00Z'),'open');
for(const text of ['8AM-2AM Daily','11AM - 8PM DAILY','9am-5pm Mon-Fri','10am-2pm weekends'])assert.equal(H.parse(text).valid,true,text);
assert.equal(H.parse('8AM-2AM Daily').normalized,H.parse('Mo-Su 08:00-02:00').normalized);
assert.equal(at('8AM-2AM Daily','2026-10-10T05:59:00Z'),'open');assert.equal(at('8AM-2AM Daily','2026-10-10T06:00:00Z'),'closed');assert.equal(at('8AM-2AM Daily','2026-10-10T11:59:00Z'),'closed');assert.equal(at('8AM-2AM Daily','2026-10-10T12:00:00Z'),'open');
assert.equal(at('11AM - 8PM DAILY','2026-10-09T15:00:00Z'),'open');assert.equal(at('11AM - 8PM DAILY','2026-10-10T00:00:00Z'),'closed');
assert.equal(H.parse('9-5 Daily').valid,false);assert.equal(H.parse('8AM-2AM Daily except holidays').valid,false);
// Format families must produce the same weekly data, not merely parse without errors.
const dragon="Friday 7\u202fAM–10\u202fPM\nSaturday\t9\u202fAM–10\u202fPM\nSunday\t9\u202fAM–6\u202fPM\nMonday7\u202fAM–10\u202fPM\nTuesday\t7\u202fAM–10\u202fPM\nWednesday\t7\u202fAM–10\u202fPM\nThursday\t7\u202fAM–10\u202fPM";
assert.deepEqual(H.parse(dragon).week,H.parse('Mon-Fri 7am-10pm; Sat 9am-10pm; Sun 9am-6pm').week);
assert.equal(at(dragon,'2026-10-09T23:00:00Z'),'open');assert.equal(at(dragon,'2026-10-10T02:00:00Z'),'closed');
for(const [raw,expected] of [
 ['Tue-Thu 12pm-10pm, Fri-Sat 12pm-12am, Sun 12pm-8pm','Tue-Thu 12pm-10pm; Fri-Sat 12pm-12am; Sun 12pm-8pm'],
 ['Monday ~ Saturday, 9am to 5pm; Closed on Sundays','Mon-Sat 9am-5pm; Sun closed'],
 ['CLOSED MONDAY AND TUESDAY','Mon,Tue closed'],
 ['Mon & Wed 9am-noon and 2pm-5pm','Mon,Wed 9am-noon,2pm-5pm'],
 ['Mon. 09:00-17:00','Mon 09:00-17:00'],
 ['Store: Tuesday-Friday 9:30am-11:30am and 1pm-3pm','Tue-Fri 9:30am-11:30am,1pm-3pm'],
 ['Opening hours:\nMonday\n7 AM–10 PM\nTuesday\nClosed','Mon 7am-10pm; Tue closed']
])assert.deepEqual(H.parse(raw).week,H.parse(expected).week,raw);
let variants=0;const fullDays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
for(const dash of ['-','–','—','−',' to ',' until '])for(const meridiem of [['am','pm'],['AM','PM'],['a.m.','p.m.'],['a. m.','p. m.']])for(const space of [' ','\u00a0','\u202f','\t'])for(const layout of ['inline','compact','table']){
 const raw=fullDays.map(d=>d+(layout==='compact'?'':layout==='table'?'\n':space)+'9'+space+meridiem[0]+dash+'5'+space+meridiem[1]).join('\n'),parsed=H.parse(raw);
 assert.equal(parsed.valid,true,raw);assert.deepEqual(parsed.week,H.parse('Daily 9am-5pm').week,raw);assert.equal(H.parse(parsed.normalized).normalized,parsed.normalized);variants++;
}
for(const raw of ['Mon 9am-5pm, Tue 9-5','Hours: Mon 9am-5pm; holiday hours differ','Mon 9am-5pm; Mon 10am-6pm','Monday\n(Columbus Day)\n9am-5pm\nHours might differ'])assert.equal(H.parse(raw).valid,false,raw);
console.log('Format corpus: '+variants+' generated weekly layouts plus pasted-table, missing-space, punctuation, closed-day, split-shift and ambiguous-input regressions passed.');
console.log('Hours: normalization, weekly ranges, split shifts, overnight rollover, exact closing, time zones/DST and conservative unknown handling passed.');
