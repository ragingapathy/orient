// Offline check of the sync merge (no browser, no server):  node sync-merge-check.cjs
const assert = require('node:assert/strict');
const { merge, same } = require('./public/sync.js');
const base = { version: 1, saved: ['a', 'b'], visited: ['a'], visitLog: { a: ['2026-10-01T10:00:00Z'] }, ratings: { a: 3 }, custom: [{ id: 'local-1', name: 'One', note: '' }], fog: true, heat: false, circuits: [{ id: 'c1', stops: ['a', 'b', 'c'] }] };
const clone = o => JSON.parse(JSON.stringify(o));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('only one side changed: that side wins whole', () => {
  const mine = clone(base); mine.saved.push('z');
  assert.ok(same(merge(base, mine, clone(base)), mine));
  assert.ok(same(merge(base, clone(base), mine), mine));
});
t('visits logged on two devices are both kept', () => {
  const phone = clone(base), desk = clone(base);
  phone.visitLog.a.push('2026-10-05T09:00:00Z'); desk.visitLog.a.push('2026-10-06T18:30:00Z'); desk.visited.push('q'); desk.visitLog.q = ['2026-10-06T19:00:00Z'];
  const m = merge(base, phone, desk);
  assert.equal(m.visitLog.a.length, 3); assert.deepEqual(m.visitLog.q, ['2026-10-06T19:00:00Z']); assert.ok(m.visited.includes('q'));
});
t('a visit removed on one device stays removed, the other device\'s new visit stays', () => {
  const phone = clone(base), desk = clone(base);
  phone.visitLog.a = []; desk.visitLog.a.push('2026-10-07T12:00:00Z');
  assert.deepEqual(merge(base, phone, desk).visitLog.a, ['2026-10-07T12:00:00Z']);
});
t('saves and unsaves from both devices combine', () => {
  const phone = clone(base), desk = clone(base);
  phone.saved = ['a', 'c']; // unsaved b, saved c
  desk.saved = ['a', 'b', 'd']; // saved d
  assert.deepEqual([...merge(base, phone, desk).saved].sort(), ['a', 'c', 'd']);
});
t('a place added on each device appears once each; one edited on both merges field by field', () => {
  const phone = clone(base), desk = clone(base);
  phone.custom.push({ id: 'local-2', name: 'Two', note: '' }); desk.custom.push({ id: 'local-3', name: 'Three', note: '' });
  phone.custom[0].name = 'One (phone)'; desk.custom[0].note = 'from desk';
  const m = merge(base, phone, desk);
  assert.deepEqual(m.custom.map(p => p.id).sort(), ['local-1', 'local-2', 'local-3']);
  const one = m.custom.find(p => p.id === 'local-1'); assert.equal(one.name, 'One (phone)'); assert.equal(one.note, 'from desk');
});
t('a place deleted on one device is gone unless the other edited it', () => {
  const phone = clone(base), desk = clone(base); phone.custom = [];
  assert.deepEqual(merge(base, phone, desk).custom, []);
  desk.custom[0].note = 'edited'; assert.equal(merge(base, phone, desk).custom[0].note, 'edited');
});
t('ratings: different places combine, same place keeps the editor\'s value', () => {
  const phone = clone(base), desk = clone(base); phone.ratings.b = 5; desk.ratings.c = 2; desk.ratings.a = 4; phone.ratings.a = 1;
  const m = merge(base, phone, desk); assert.equal(m.ratings.b, 5); assert.equal(m.ratings.c, 2); assert.equal(m.ratings.a, 1);
});
t('settings changed on one side only survive the other side\'s edits', () => {
  const phone = clone(base), desk = clone(base); phone.heat = true; desk.saved.push('x');
  const m = merge(base, phone, desk); assert.equal(m.heat, true); assert.ok(m.saved.includes('x')); assert.equal(m.fog, true);
});
t('a reordered circuit on one device is not scrambled by an unrelated change on the other', () => {
  const phone = clone(base), desk = clone(base); phone.circuits[0].stops = ['c', 'b', 'a']; desk.saved.push('x');
  assert.deepEqual(merge(base, phone, desk).circuits[0].stops, ['c', 'b', 'a']);
});
t('a first connection with no shared history takes the server\'s settings and unions the lists', () => {
  const phone = { version: 1, saved: ['p'], fog: true, ratings: { p: 4 } }, server = { version: 1, saved: ['s'], fog: false, ratings: { s: 2 } };
  const m = merge(undefined, phone, server, true);
  assert.deepEqual([...m.saved].sort(), ['p', 's']); assert.equal(m.fog, false); assert.equal(m.ratings.p, 4); assert.equal(m.ratings.s, 2);
});
t('merging is stable: merging the result again changes nothing', () => {
  const phone = clone(base), desk = clone(base); phone.saved.push('p'); desk.saved.push('d'); desk.visitLog.a.push('2026-10-08T08:00:00Z');
  const m = merge(base, phone, desk); assert.ok(same(merge(m, m, m), m)); assert.ok(same(merge(base, m, m), m));
});
console.log('PASS: ' + n + ' merge cases');
