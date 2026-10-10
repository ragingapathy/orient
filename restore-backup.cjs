#!/usr/bin/env node
'use strict';
// Puts an earlier copy of the map back as the one this computer keeps for sync.
//
//   node restore-backup.cjs                  list the copies
//   node restore-backup.cjs 2026-10-10       restore that day's copy (or any name from the list)
//   node restore-backup.cjs --latest         restore the newest readable copy
//
// What it does: saves the map as it is now (a "before-restore" copy), checks the chosen copy, writes it as the
// live map with a newer revision number, and tells you to restart Orient so it reads the file. Phones and
// other browsers then follow it: anything added after that copy was made is removed from them as well, because
// restoring means going back. Use Export in Your field kit first if you want to keep anything from now.
const fs = require('node:fs');
const path = require('node:path');
const B = require('./backup.cjs');

const arg = process.argv[2];
const info = B.list();

function show() {
  if (!info.backups.length) { console.log('No backups yet in ' + B.backupDir()); return; }
  console.log('Backups in ' + B.backupDir() + '\n');
  for (const b of info.backups) console.log('  ' + (b.ok ? 'ok     ' : 'UNREADABLE ') + b.name.padEnd(54) + String(Math.max(1, Math.round(b.bytes / 1024))).padStart(6) + ' KB   ' + (b.updatedAt ? 'map from ' + b.updatedAt.slice(0, 16).replace('T', ' ') + ' UTC' : ''));
  console.log('\nRestore one with: node restore-backup.cjs <name or date>   (for example 2026-10-10)');
}

if (!arg) { show(); process.exit(0); }

let chosen;
if (arg === '--latest') chosen = info.lastGood;
else chosen = info.backups.find(b => b.name === arg || b.name === arg + '.json' || b.name === 'orient-state-' + arg + '.json') || null;
if (!chosen) { console.error('No backup matches "' + arg + '".\n'); show(); process.exit(1); }
if (!chosen.ok) { console.error(chosen.name + ' cannot be read, so it will not be restored.'); process.exit(1); }

const text = fs.readFileSync(path.join(B.backupDir(), chosen.name), 'utf8');
const env = B.check(text);
if (!env) { console.error('That copy failed its check. Nothing was changed.'); process.exit(1); }

// keep what is there now, so a restore can itself be undone
let current = null; try { current = B.check(fs.readFileSync(B.liveFile(), 'utf8')); } catch { /* no live map */ }
let safety = null;
if (current) safety = B.saveExtra('restore', current);

const rev = Math.max(env.rev || 0, current ? current.rev || 0 : 0) + 1;
const restored = { rev, updatedAt: new Date().toISOString(), state: env.state };
const tmp = B.liveFile() + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(restored), { mode: 0o600 });
if (!B.check(fs.readFileSync(tmp, 'utf8'))) { fs.unlinkSync(tmp); console.error('The restored file failed its check. Nothing was changed.'); process.exit(1); }
fs.renameSync(tmp, B.liveFile());

console.log('Restored ' + chosen.name + ' (' + B.size(env.state) + ' saved places and visits) as revision ' + rev + '.');
if (safety) console.log('The map as it was a moment ago is saved as ' + safety + '.');
console.log('\nNow restart Orient so it reads the file:  docker compose restart');
