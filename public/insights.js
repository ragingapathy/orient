/* Your map in numbers: a retractable drawer on My Map that shows what you have been building.
   Visits and rhythm, your regulars, how you explore, what you have contributed, "a year ago today" and a
   year-in-review. Everything is worked out here, in this browser, from your own map; nothing is sent anywhere.
   No streaks and no targets: it describes what you did and never scolds. */
'use strict';
(function (root) {
  // ======================= the numbers (pure; tested in insights-check.cjs) =======================
  const DAY = 864e5, SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const pad = n => String(n).padStart(2, '0');
  const fmts = new Map();
  function fmt(tz) {
    if (!fmts.has(tz)) { let f; try { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short' }); } catch { f = fmt('UTC'); } fmts.set(tz, f); }
    return fmts.get(tz);
  }
  function parts(date, tz) {
    const o = {}; for (const p of fmt(tz).formatToParts(date)) o[p.type] = p.value;
    return { day: o.year + '-' + o.month + '-' + o.day, dow: SHORT.indexOf(o.weekday), hour: Number(o.hour) % 24 };
  }
  const dayDow = s => new Date(s + 'T12:00:00Z').getUTCDay();
  const addDays = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10);
  const mondayOf = s => addDays(s, -((dayDow(s) + 6) % 7));
  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY);

  // One logged visit: an ISO time (a tap), a plain day (added later) or '' (an older mark with no date).
  function entry(v, tz) {
    if (typeof v !== 'string' || !v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const d = new Date(v + 'T12:00:00Z'); return isNaN(d) ? null : { day: v, dow: d.getUTCDay(), hour: null }; }
    const t = Date.parse(v); return isNaN(t) ? null : parts(new Date(t), tz);
  }
  const band = h => (h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night');
  const top = (counts, ties = i => i) => counts.reduce((best, c, i) => (c > counts[best] || (c === counts[best] && c > 0 && ties(i) < ties(best)) ? i : best), 0);

  // lookup(id) -> { name, kind, photoMemory } or null
  function compute(store, { now = new Date(), tz, lookup = () => null } = {}) {
    // Whatever is in storage (older versions, damage), every field is the type it should be before anything uses it.
    const arr = v => (Array.isArray(v) ? v : []), rec = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}), src = rec(store);
    store = { ...src, visited: arr(src.visited), saved: arr(src.saved), custom: arr(src.custom), circuits: arr(src.circuits), events: arr(src.events),
      ratings: rec(src.ratings), details: rec(src.details), visitLog: rec(src.visitLog), photos: rec(src.photos), journey: rec(src.journey), commons: rec(src.commons), home: rec(src.home) };
    tz = tz || store.home.timeZone || 'UTC';
    const today = parts(now, tz).day, year = Number(today.slice(0, 4));
    const log = store.visitLog && typeof store.visitLog === 'object' ? store.visitLog : {};
    const visitedIds = [...new Set([...(store.visited || []), ...Object.keys(log)])];
    const named = id => lookup(id) || { name: 'A place', kind: 'Place' };

    const perPlace = new Map(); // id -> { visits, dated:[{day,dow,hour}], undated }
    for (const id of visitedIds) {
      const list = Array.isArray(log[id]) && log[id].length ? log[id] : (store.visited || []).includes(id) ? [''] : [];
      const dated = [], undated = list.filter(v => !entry(v, tz)).length;
      for (const v of list) { const e = entry(v, tz); if (e) dated.push(e); }
      if (list.length) perPlace.set(id, { id, visits: list.length, dated, undated });
    }
    const all = [...perPlace.values()], dated = all.flatMap(p => p.dated.map(e => ({ ...e, id: p.id })));
    const total = all.reduce((n, p) => n + p.visits, 0);
    const perDay = new Map(); for (const e of dated) perDay.set(e.day, (perDay.get(e.day) || 0) + 1);

    // rhythm
    const weekday = [0, 0, 0, 0, 0, 0, 0]; for (const e of dated) weekday[e.dow]++;
    const topDow = dated.length ? top(weekday, i => (i + 6) % 7) : null; // ties go to the earlier day of the week
    const timed = dated.filter(e => e.hour !== null), bands = { morning: 0, afternoon: 0, evening: 0, night: 0 }; for (const e of timed) bands[band(e.hour)]++;
    const topBand = timed.length >= 5 ? Object.keys(bands).reduce((a, b) => (bands[b] > bands[a] ? b : a)) : null;

    // the last twelve weeks, Monday first
    const gridStart = addDays(mondayOf(today), -77), grid = [];
    for (let w = 0; w < 12; w++) { const col = []; for (let d = 0; d < 7; d++) { const day = addDays(gridStart, w * 7 + d); col.push({ day, count: day > today ? null : perDay.get(day) || 0 }); } grid.push(col); }
    // twelve months
    const monthly = []; for (let i = 11; i >= 0; i--) { const d = new Date(Date.UTC(year, Number(today.slice(5, 7)) - 1 - i, 1)); monthly.push({ key: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1), month: d.getUTCMonth(), visits: 0, fresh: 0 }); }
    const slot = new Map(monthly.map(m => [m.key, m])); for (const e of dated) { const m = slot.get(e.day.slice(0, 7)); if (m) m.visits++; }
    // weeks
    const byWeek = new Map(); for (const e of dated) { const k = mondayOf(e.day); byWeek.set(k, (byWeek.get(k) || 0) + 1); }
    const bestWeek = [...byWeek].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0] || null;
    const calMonth = new Array(12).fill(0); for (const e of dated) calMonth[Number(e.day.slice(5, 7)) - 1]++;
    const busiestMonth = dated.length ? top(calMonth) : null;

    // first visits
    const first = new Map(); for (const p of all) if (p.dated.length) first.set(p.id, p.dated.map(e => e.day).sort()[0]);
    for (const [id, d] of first) { const m = slot.get(d.slice(0, 7)); if (m) m.fresh++; }
    const since = n => addDays(today, -n);
    const last7 = dated.filter(e => e.day > since(7)).length, last30 = dated.filter(e => e.day > since(30)).length;
    const recentIds = [...new Set(dated.filter(e => e.day > since(30)).map(e => e.id))];
    const newRecent = recentIds.filter(id => first.get(id) > since(30)).length;

    // regulars and favourites
    const rating = id => (store.ratings && store.ratings[id]) || 0;
    const regulars = all.slice().sort((a, b) => b.visits - a.visits || rating(b.id) - rating(a.id) || named(a.id).name.localeCompare(named(b.id).name)).slice(0, 5)
      .map(p => ({ id: p.id, name: named(p.id).name, kind: named(p.id).kind, visits: p.visits, rating: rating(p.id), last: p.dated.length ? p.dated.map(e => e.day).sort().pop() : null }));
    const loved = Object.entries(store.ratings || {}).filter(([, r]) => r === 5).map(([id]) => named(id).name).sort().slice(0, 6);
    const kinds = new Map(); for (const p of all) { const k = named(p.id).kind || 'Place'; kinds.set(k, (kinds.get(k) || 0) + p.visits); }
    const kindList = [...kinds].sort((a, b) => b[1] - a[1]).map(([kind, visits]) => ({ kind, visits }));

    const saved = store.saved || [], toTry = saved.filter(id => !perPlace.has(id));
    const coverage = saved.length ? Math.round(100 * (saved.length - toTry.length) / saved.length) : null;

    // what you are building
    const custom = Array.isArray(store.custom) ? store.custom : [];
    const noted = new Set(); // a place counts once, whether its note is kept on the place or in its details
    for (const p of custom) if (p && p.note && String(p.note).trim()) noted.add(p.id);
    for (const [id, d] of Object.entries(store.details || {})) if (d && d.note && String(d.note).trim()) noted.add(id);
    const notes = noted.size;
    const photoCount = (() => { const p = store.photos; if (!p || typeof p !== 'object') return 0; return Object.values(p).reduce((n, v) => n + (Array.isArray(v) ? v.length : v ? 1 : 0), 0); })();
    const records = store.commons && Array.isArray(store.commons.records) ? store.commons.records : [];
    const building = {
      placesAdded: custom.filter(p => p && !p.photoMemory).length, photoMemories: custom.filter(p => p && p.photoMemory).length, photos: photoCount, notes,
      ratings: Object.keys(store.ratings || {}).length, circuits: (store.circuits || []).length, calendarEntries: (store.events || []).length,
      shared: records.length, sharedPlaces: new Set(records.map(r => r.localPlaceId)).size, milestones: Object.keys((store.journey && store.journey.earned) || {}).length,
    };

    // a year ago today: the same date in earlier years, else the same few days
    const md = today.slice(5), ago = [];
    for (let y = year - 1; y >= year - 6; y--) {
      const exact = dated.filter(e => e.day === y + '-' + md);
      const near = exact.length ? [] : dated.filter(e => Math.abs(daysBetween(y + '-' + md, e.day)) <= 3);
      const hit = exact.length ? exact : near; if (!hit.length) continue;
      ago.push({ yearsAgo: year - y, exact: !!exact.length, places: [...new Set(hit.map(e => e.id))].map(id => named(id).name).slice(0, 3), visits: hit.length });
    }

    // a year in review, for every year with visits
    const years = {};
    for (const y of [...new Set(dated.map(e => Number(e.day.slice(0, 4))))].sort((a, b) => b - a).slice(0, 6)) years[y] = review(y, { dated, all, first, named, calMonth: null });
    return { today, year, tz, total, placesVisited: all.length, datedVisits: dated.length, undatedVisits: all.reduce((n, p) => n + p.undated, 0), savedCount: saved.length, toTry: toTry.length, coverage,
      weekday, topDow, topDowName: topDow === null ? null : WEEKDAYS[topDow], bands, topBand, timed: timed.length, grid, monthly, bestWeek: bestWeek && { start: bestWeek[0], end: addDays(bestWeek[0], 6), visits: bestWeek[1] }, busiestMonth: busiestMonth === null ? null : MONTHS[busiestMonth],
      last7, last30, newRecent, returningRecent: recentIds.length - newRecent, regulars, loved, kinds: kindList, building, ago, years };
  }

  function review(y, { dated, all, first, named }) {
    const mine = dated.filter(e => e.day.startsWith(String(y))), ids = [...new Set(mine.map(e => e.id))];
    const counts = new Map(); for (const e of mine) counts.set(e.id, (counts.get(e.id) || 0) + 1);
    const fav = [...counts].sort((a, b) => b[1] - a[1] || named(a[0]).name.localeCompare(named(b[0]).name))[0];
    const months = new Array(12).fill(0), dow = [0, 0, 0, 0, 0, 0, 0]; for (const e of mine) { months[Number(e.day.slice(5, 7)) - 1]++; dow[e.dow]++; }
    const firstVisit = mine.slice().sort((a, b) => a.day.localeCompare(b.day))[0];
    return { year: y, visits: mine.length, places: ids.length, newPlaces: ids.filter(id => (first.get(id) || '').startsWith(String(y))).length,
      favourite: fav ? { name: named(fav[0]).name, visits: fav[1] } : null, busiestMonth: mine.length ? MONTHS[top(months)] : null, busiestMonthVisits: Math.max(...months),
      weekday: mine.length ? WEEKDAYS[top(dow, i => (i + 6) % 7)] : null, firstVisit: firstVisit ? { day: firstVisit.day, name: named(firstVisit.id).name } : null,
      activeDays: new Set(mine.map(e => e.day)).size };
  }

  const api = { compute, entry, parts, addDays, mondayOf, WEEKDAYS, MONTHS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ======================= the drawer (browser only) =======================
  const KEY = 'orient-field-map-v1', OPEN = 'orient-insights-open';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const short = day => { const [y, m, d] = day.split('-').map(Number); return MONTHS[m - 1].slice(0, 3) + ' ' + d; };
  let drawer = null, data = null, picked = null, expanded = false, tickTimer = 0;
  try { expanded = localStorage.getItem(OPEN) === '1'; } catch { /* default closed */ }

  function readStore() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
  function lookupFor(store) {
    const byId = new Map();
    const list = v => (Array.isArray(v) ? v : []);
    for (const p of list(window.ORIENT_CATALOG)) if (p && p.id) byId.set(p.id, p);
    for (const p of list(store.osm)) if (p && p.id) byId.set(p.id, p);
    for (const p of list(store.custom)) if (p && p.id) byId.set(p.id, p);
    return id => byId.get(id) || null;
  }
  const refresh = () => { const s = readStore(); data = s ? compute(s, { lookup: lookupFor(s) }) : null; };

  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  function bars() {
    const max = Math.max(1, ...data.weekday), order = [1, 2, 3, 4, 5, 6, 0], letter = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return '<div class="ins-bars" role="img" aria-label="Visits by day of the week: ' + order.map(d => SHORT[d] + ' ' + data.weekday[d]).join(', ') + '">' + order.map(d => '<div class="ins-bar' + (d === data.topDow ? ' top' : '') + '" title="' + esc(SHORT[d] + ': ' + plural(data.weekday[d], 'visit')) + '"><i style="--h:' + (data.weekday[d] / max).toFixed(3) + '"></i><b>' + data.weekday[d] + '</b><span>' + letter[d] + '</span></div>').join('') + '</div>';
  }
  function heat() {
    const max = Math.max(1, ...data.grid.flat().map(c => c.count || 0));
    return '<div class="ins-grid" role="img" aria-label="Your last twelve weeks, one square a day">' + data.grid.map(col => '<div>' + col.map(c => '<i class="' + (c.count === null ? 'future' : c.count ? 'l' + Math.min(4, Math.ceil(4 * c.count / max)) : '') + (c.day === data.today ? ' today' : '') + '" title="' + esc(c.count === null ? '' : short(c.day) + ': ' + plural(c.count, 'visit')) + '"></i>').join('') + '</div>').join('') + '</div>';
  }
  function ring(pct) {
    const r = 26, c = 2 * Math.PI * r;
    return '<svg class="ins-ring" viewBox="0 0 64 64" role="img" aria-label="' + pct + ' percent of your saved places visited"><circle cx="32" cy="32" r="' + r + '" class="bg"/><circle cx="32" cy="32" r="' + r + '" class="fg" stroke-dasharray="' + c.toFixed(1) + '" style="--full:' + c.toFixed(1) + ';--to:' + (c * (1 - pct / 100)).toFixed(1) + '" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle">' + pct + '%</text></svg>';
  }
  const PALETTE = ['#205b4a', '#ca5b30', '#d9a441', '#4f8f7f', '#8b6bb1', '#99a8a3'];
  function kindsBar() {
    const sum = data.kinds.reduce((n, k) => n + k.visits, 0); if (!sum) return '';
    const shown = data.kinds.slice(0, 5), rest = data.kinds.slice(5).reduce((n, k) => n + k.visits, 0), list = rest ? [...shown, { kind: 'Everything else', visits: rest }] : shown;
    return '<div class="ins-kinds" role="img" aria-label="Visits by kind of place">' + list.map((k, i) => '<i style="--w:' + (100 * k.visits / sum).toFixed(1) + '%;background:' + PALETTE[i] + '" title="' + esc(k.kind + ': ' + k.visits) + '"></i>').join('') + '</div>'
      + '<ul class="ins-legend">' + list.map((k, i) => '<li><i style="background:' + PALETTE[i] + '"></i>' + esc(k.kind) + '<b>' + k.visits + '</b></li>').join('') + '</ul>';
  }
  function spark() {
    const max = Math.max(1, ...data.monthly.map(m => m.fresh));
    return '<div class="ins-spark" role="img" aria-label="New places by month, last twelve months">' + data.monthly.map(m => '<div title="' + esc(MONTHS[m.month] + ': ' + plural(m.fresh, 'new place')) + '"><i style="--h:' + (m.fresh / max).toFixed(3) + '"></i><span>' + MONTHS[m.month][0] + '</span></div>').join('') + '</div>';
  }
  function yearCard() {
    const ys = Object.keys(data.years).map(Number).sort((a, b) => b - a); if (!ys.length) return '';
    const y = ys.includes(picked) ? picked : ys[0], r = data.years[y];
    const facts = [r.favourite ? 'Your most-visited place was <strong>' + esc(r.favourite.name) + '</strong>, ' + plural(r.favourite.visits, 'time') + '.' : '', r.busiestMonth ? '<strong>' + r.busiestMonth + '</strong> was your busiest month (' + plural(r.busiestMonthVisits, 'visit') + ').' : '', r.weekday ? 'You went out most on <strong>' + r.weekday + '</strong>.' : '', r.firstVisit ? 'It began on ' + short(r.firstVisit.day) + ' at <strong>' + esc(r.firstVisit.name) + '</strong>.' : ''].filter(Boolean);
    return '<section class="ins-card ins-year"><div class="ins-yearhead"><span class="ins-kicker">Your year in Orient</span>' + (ys.length > 1 ? '<span class="ins-years" role="group" aria-label="Choose a year">' + ys.map(v => '<button type="button" data-ins-year="' + v + '"' + (v === y ? ' aria-pressed="true"' : '') + '>' + v + '</button>').join('') + '</span>' : '') + '</div>'
      + '<div class="ins-bignum"><b>' + r.year + '</b></div>'
      + '<p class="ins-headline">You visited <strong>' + plural(r.places, 'place') + '</strong>' + (r.newPlaces ? ', ' + r.newPlaces + ' of them new to you' : '') + ', across ' + plural(r.activeDays, 'day') + '.</p>'
      + '<ul class="ins-facts">' + facts.map(f => '<li>' + f + '</li>').join('') + '</ul>'
      + '<button type="button" class="ins-copy" data-ins-copy="' + y + '">Copy as text</button><span class="ins-note" data-ins-copied></span></section>';
  }
  function yearText(y) {
    const r = data.years[y]; if (!r) return '';
    return ['My ' + r.year + ' in Orient', 'Visited ' + plural(r.places, 'place') + (r.newPlaces ? ' (' + r.newPlaces + ' new)' : '') + ' on ' + plural(r.activeDays, 'day') + '.', r.favourite ? 'Most visited: ' + r.favourite.name + ' (' + plural(r.favourite.visits, 'time') + ').' : '', r.busiestMonth ? 'Busiest month: ' + r.busiestMonth + '.' : '', r.weekday ? 'Most active on ' + r.weekday + '.' : ''].filter(Boolean).join('\n');
  }

  function body() {
    const d = data, b = d.building;
    const hero = [[d.placesVisited, 'places visited'], [d.total, 'visits logged'], [d.toTry, 'saved, still to try'], [b.shared, 'observations shared']];
    const tally = [['placesAdded', 'places you added', 'map-pin'], ['notes', 'notes written', 'notebook-pen'], ['ratings', 'places rated', 'star'], ['photos', 'photos kept', 'image'], ['circuits', 'circuits made', 'route'], ['calendarEntries', 'calendar entries', 'calendar-days'], ['sharedPlaces', 'places shared with a commons', 'users'], ['milestones', 'milestones earned', 'flag']];
    const ago = d.ago.length ? '<section class="ins-card ins-ago"><span class="ins-kicker">' + (d.ago[0].exact ? 'A year ago today' : 'Around this time') + '</span>' + d.ago.slice(0, 3).map(a => '<p><b>' + (a.yearsAgo === 1 ? 'A year ago' : a.yearsAgo + ' years ago') + (a.exact ? '' : ', around now') + '</b> you went to ' + a.places.map(esc).join(', ') + '.</p>').join('') + '</section>' : '';
    const built = '<section class="ins-card"><span class="ins-kicker">What you are building</span><ul class="ins-tally">' + tally.filter(([k]) => b[k]).map(([k, l, i]) => '<li><i data-lucide="' + i + '" aria-hidden="true"></i><b data-count="' + b[k] + '">' + b[k] + '</b><span>' + l + '</span></li>').join('') + '</ul>'
        + (tally.every(([k]) => !b[k]) ? '<p class="ins-line">Add a place, a note, a photo or a rating and it shows up here.</p>' : '') + '</section>';
    if (!d.total) return '<div class="ins-empty"><b>' + (d.savedCount || b.placesAdded ? 'Ready when you are.' : 'Your map is just beginning.') + '</b><p>Tap the check beside the bookmark each time you go somewhere. Your rhythm, your regulars and your year will fill in here.</p></div>' + built + '<p class="ins-fine">Worked out on this device from your own map. Nothing here is sent anywhere, and nothing is a target.</p>';
    return '<div class="ins-hero">' + hero.map(([n, l]) => '<div><b data-count="' + n + '">' + n + '</b><span>' + l + '</span></div>').join('') + '</div>'
      + ago
      + '<section class="ins-card"><span class="ins-kicker">Your rhythm</span>' + (d.topDow === null ? '<p class="ins-line">Once visits carry a date, your week appears here.</p>' : '<p class="ins-headline"><strong>' + d.topDowName + '</strong> are your day.</p>' + bars()
        + '<p class="ins-line">' + plural(d.last7, 'visit') + ' this week, ' + plural(d.last30, 'visit') + ' in the last 30 days' + (d.bestWeek ? '. Your best week was ' + short(d.bestWeek.start) + ' to ' + short(d.bestWeek.end) + ' with ' + d.bestWeek.visits + '.' : '.') + '</p>'
        + '<span class="ins-sub">The last twelve weeks</span>' + heat() + (d.topBand ? '<p class="ins-line">You tend to go in the <strong>' + d.topBand + '</strong>.</p>' : '')) + '</section>'
      + (d.regulars.length ? '<section class="ins-card"><span class="ins-kicker">Your regulars</span><ol class="ins-regulars">' + d.regulars.map(r => '<li><div><strong>' + esc(r.name) + '</strong><small>' + esc(r.kind || '') + (r.last ? ' · last ' + short(r.last) : '') + '</small></div><div class="ins-count"><b>' + r.visits + '</b>' + (r.rating ? '<span aria-label="' + r.rating + ' out of 5">' + stars(r.rating) + '</span>' : '') + '</div></li>').join('') + '</ol>'
        + (d.loved.length ? '<span class="ins-sub">Rated five stars</span><p class="ins-chips">' + d.loved.map(n => '<span>' + esc(n) + '</span>').join('') + '</p>' : '') + '</section>' : '')
      + '<section class="ins-card"><span class="ins-kicker">How you explore</span><div class="ins-explore">' + (d.coverage === null ? '' : '<div>' + ring(d.coverage) + '<span>of your saved places visited</span></div>')
        + '<div><b class="ins-big" data-count="' + d.newRecent + '">' + d.newRecent + '</b><span>new places in the last 30 days, ' + d.returningRecent + ' you went back to</span></div></div>'
        + (d.datedVisits ? '<span class="ins-sub">New places by month</span>' + spark() : '') + (d.kinds.length ? '<span class="ins-sub">Where your visits go</span>' + kindsBar() : '') + '</section>'
      + built
      + yearCard()
      + '<p class="ins-fine">Worked out on this device from your own map. Nothing here is sent anywhere, and nothing is a target.</p>';
  }
  function teaser() {
    if (!data || (!data.total && !data.savedCount)) return 'Where you go, and what you are building';
    const bits = [plural(data.placesVisited, 'place') + ' visited']; if (data.last7) bits.push(plural(data.last7, 'visit') + ' this week'); else if (data.toTry) bits.push(data.toTry + ' to try');
    return bits.join(' · ');
  }
  function build() {
    if (drawer) return;
    const world = document.querySelector('.world'); if (!world) return;
    drawer = document.createElement('section'); drawer.id = 'insights'; drawer.className = 'insights'; drawer.setAttribute('aria-label', 'Your map in numbers'); drawer.hidden = true;
    drawer.addEventListener('click', onClick); world.append(drawer);
  }
  function paint() {
    if (!drawer) return;
    drawer.classList.toggle('open', expanded);
    drawer.innerHTML = '<button type="button" class="ins-head" data-ins="toggle" aria-expanded="' + expanded + '" aria-controls="ins-body"><span class="ins-icon"><i data-lucide="chart-column" aria-hidden="true"></i></span><span class="ins-title"><strong>Your map so far</strong><small>' + esc(teaser()) + '</small></span><i data-lucide="chevron-up" class="ins-chev" aria-hidden="true"></i></button>'
      + '<div class="ins-body" id="ins-body"' + (expanded ? '' : ' hidden') + '>' + (expanded && data ? body() : '') + '</div>';
    if (window.lucide) lucide.createIcons();
    if (expanded) requestAnimationFrame(() => { drawer.classList.add('in'); countUp(); });
  }
  function countUp() {
    if (reduced()) return;
    for (const el of drawer.querySelectorAll('[data-count]')) {
      const to = Number(el.dataset.count); if (!to) continue; const t0 = performance.now(), dur = 650;
      const step = t => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); }; el.textContent = 0; requestAnimationFrame(step);
    }
  }
  function onClick(e) {
    const t = e.target.closest('[data-ins]'), y = e.target.closest('[data-ins-year]'), c = e.target.closest('[data-ins-copy]');
    if (t) { expanded = !expanded; try { localStorage.setItem(OPEN, expanded ? '1' : '0'); } catch { /* fine */ } refresh(); paint(); if (expanded) drawer.querySelector('.ins-head').scrollIntoView?.({ block: 'nearest' }); }
    else if (y) { picked = Number(y.dataset.insYear); const sc = drawer.querySelector('.ins-body').scrollTop; paint(); drawer.querySelector('.ins-body').scrollTop = sc; }
    else if (c) { navigator.clipboard.writeText(yearText(Number(c.dataset.insCopy))).then(() => { const n = drawer.querySelector('[data-ins-copied]'); if (n) n.textContent = 'Copied.'; }, () => { const n = drawer.querySelector('[data-ins-copied]'); if (n) n.textContent = 'Copying isn’t available here.'; }); }
  }

  // show only on My Map, with nothing else covering the bottom of the map
  function shouldShow() {
    const tab = document.querySelector('.bottom-nav [aria-pressed="true"]')?.dataset.tab, sheet = document.getElementById('sheet'), panel = document.getElementById('panel');
    return tab === 'My Map' && (!sheet || sheet.hidden) && (!panel || panel.hidden);
  }
  function sync() {
    build(); if (!drawer) return;
    const show = shouldShow();
    if (show && drawer.hidden) { refresh(); paint(); }
    drawer.hidden = !show;
  }
  function init() {
    sync();
    const watch = new MutationObserver(() => requestAnimationFrame(sync));
    for (const sel of ['#sheet', '#panel']) { const el = document.querySelector(sel); if (el) watch.observe(el, { attributes: true, attributeFilter: ['hidden', 'class'] }); }
    const nav = document.querySelector('.bottom-nav'); if (nav) watch.observe(nav, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
    // the map changes through clicks (a visit logged, a place added): refresh shortly after any of them
    document.addEventListener('click', e => { if (!drawer || drawer.hidden || drawer.contains(e.target)) return; clearTimeout(tickTimer); tickTimer = setTimeout(() => { refresh(); paint(); }, 500); }, true);
    addEventListener('storage', e => { if (e.key === KEY && drawer && !drawer.hidden) { refresh(); paint(); } });
  }
  root.OrientInsights = Object.assign({ open() { expanded = true; refresh(); paint(); }, close() { expanded = false; paint(); }, sync }, api);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
