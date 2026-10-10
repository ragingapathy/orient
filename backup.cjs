'use strict';
// Backups of the map copy this computer keeps for sync (data/orient-state.json).
//
//  - One file per day in data/backups/, refreshed hourly while the map changes, so today's copy is never more
//    than an hour old and yesterday's is the final state of yesterday.
//  - Two weeks of days are kept, then the Sunday copies for eight more weeks.
//  - A copy only replaces another after it has been written, read back and checked, so a bad write cannot
//    destroy a good backup.
//  - Before a write that would shrink the map sharply (a reset, a sync mistake) the map as it was is saved
//    first, as a "before-change" copy. The newest few are kept.
// Dates are UTC. Everything stays in data/backups next to the live copy.
const fs = require('node:fs');
const path = require('node:path');

const DAILY = 14, WEEKLY = 8, EXTRA = 5, SHRINK_BELOW = 0.6, SHRINK_MIN = 10;
const dataDir = () => process.env.ORIENT_DATA_DIR || path.join(__dirname, 'data');
const backupDir = () => path.join(dataDir(), 'backups');
const liveFile = () => path.join(dataDir(), 'orient-state.json');
const NAME = /^orient-state-(\d{4}-\d{2}-\d{2})\.json$/;
const EXTRA_NAME = /^orient-state-(before-(?:change|restore))-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)\.json$/;

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const stampOf = (d = new Date()) => d.toISOString().slice(0, 19).replace(/:/g, '-') + 'Z';

// A usable copy is the sync envelope with a version-1 map in it.
function check(text) {
  try {
    const env = JSON.parse(text);
    if (!env || typeof env !== 'object' || !env.state || typeof env.state !== 'object' || env.state.version !== 1) return null;
    return env;
  } catch { return null; }
}
const size = state => (state && state.custom ? state.custom.length : 0) + (state && state.saved ? state.saved.length : 0)
  + Object.values((state && state.visitLog) || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);

function writeVerified(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  const back = fs.readFileSync(tmp, 'utf8');
  if (back !== text || !check(back)) { try { fs.unlinkSync(tmp); } catch { /* gone */ } throw new Error('The copy did not read back correctly, so it was not kept.'); }
  fs.renameSync(tmp, file);
  return Buffer.byteLength(text);
}

// Take (or refresh) today's copy of the live map.
function take(now = new Date()) {
  let text; try { text = fs.readFileSync(liveFile(), 'utf8'); } catch { return { skipped: 'There is no map on this computer yet.' }; }
  const env = check(text); if (!env) return { skipped: 'The live map is empty or unreadable, so nothing was backed up.' };
  const name = 'orient-state-' + day(now) + '.json';
  const bytes = writeVerified(path.join(backupDir(), name), text);
  rotate(now);
  return { name, bytes, rev: env.rev, ok: true };
}

// Save a map as it was, under a "before-…" name.
function saveExtra(kind, env, now = new Date()) {
  const name = 'orient-state-before-' + kind + '-' + stampOf(now) + '.json';
  writeVerified(path.join(backupDir(), name), JSON.stringify(env));
  rotate(now);
  return name;
}

// Called by sync just before it replaces the map. Never throws: sync must not fail because a backup did.
function beforeWrite(previous, nextState, now = new Date()) {
  try {
    if (!previous || !previous.state || !nextState) return null;
    const before = size(previous.state), after = size(nextState);
    if (before < SHRINK_MIN || after >= before * SHRINK_BELOW) return null;
    const recent = fs.existsSync(backupDir()) && fs.readdirSync(backupDir()).some(f => { const m = EXTRA_NAME.exec(f); return m && m[1] === 'before-change' && now - Date.parse(m[2].replace(/T(\d\d)-(\d\d)-(\d\d)Z/, 'T$1:$2:$3Z')) < 3600e3; });
    if (recent) return null; // one safety copy an hour is enough
    return saveExtra('change', previous, now);
  } catch { return null; }
}

function files() {
  let all = []; try { all = fs.readdirSync(backupDir()); } catch { return []; }
  const out = [];
  for (const f of all) {
    let m = NAME.exec(f), kind, when;
    if (m) { kind = 'daily'; when = m[1]; } else if ((m = EXTRA_NAME.exec(f))) { kind = m[1]; when = m[2]; } else continue;
    let stat; try { stat = fs.statSync(path.join(backupDir(), f)); } catch { continue; }
    out.push({ name: f, kind, when, bytes: stat.size, modified: stat.mtime.toISOString() });
  }
  return out.sort((a, b) => b.when.localeCompare(a.when));
}

function rotate(now = new Date()) {
  const all = files(), drop = new Set();
  const daily = all.filter(f => f.kind === 'daily');
  const older = daily.slice(DAILY);
  const sundays = older.filter(f => new Date(f.when + 'T00:00:00Z').getUTCDay() === 0).slice(0, WEEKLY);
  for (const f of older) if (!sundays.includes(f)) drop.add(f.name);
  for (const kind of ['before-change', 'before-restore']) all.filter(f => f.kind === kind).slice(EXTRA).forEach(f => drop.add(f.name));
  for (const n of drop) { try { fs.unlinkSync(path.join(backupDir(), n)); } catch { /* already gone */ } }
  return [...drop];
}

// All copies with whether each one is readable, and the newest good one.
function list() {
  const all = files().map(f => { let ok = false, rev = null, at = null, items = 0; try { const env = check(fs.readFileSync(path.join(backupDir(), f.name), 'utf8')); if (env) { ok = true; rev = env.rev; at = env.updatedAt; items = size(env.state); } } catch { /* unreadable */ } return { ...f, ok, rev, updatedAt: at, items }; });
  return { backups: all, lastGood: all.find(f => f.ok) || null, counts: { daily: all.filter(f => f.kind === 'daily').length, extra: all.filter(f => f.kind !== 'daily').length } };
}

let timer = null, lastRev = null;
function tick(now = new Date()) {
  try {
    const env = check(fs.readFileSync(liveFile(), 'utf8')); if (!env) return;
    const todays = path.join(backupDir(), 'orient-state-' + day(now) + '.json');
    if (env.rev === lastRev && fs.existsSync(todays)) return;
    take(now); lastRev = env.rev;
  } catch { /* try again next hour */ }
}
function start() { if (timer) return; setTimeout(tick, 5000).unref(); timer = setInterval(tick, 3600e3); timer.unref(); }

module.exports = { take, tick, start, list, beforeWrite, rotate, check, saveExtra, size, backupDir, liveFile, DAILY, WEEKLY, EXTRA };
