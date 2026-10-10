#!/usr/bin/env node
'use strict';
// Rebuilds snapshot.json (and snapshot-2.json, ... when the commons outgrows one file) from contributions/.
//   node tools/build-snapshot.cjs [repository-folder]
const fs = require('node:fs');
const path = require('node:path');
const L = require('./lib.cjs');

const root = path.resolve(process.argv[2] || process.cwd());
const files = L.contributionFiles(root);
const good = [], bad = [];
for (const rel of files) {
  const r = L.readBundle(root, rel);
  if (r.bundle) good.push(r.bundle); else bad.push({ rel, error: r.error });
}
const merged = L.merge(good);
const shards = L.shard(merged);

const names = shards.map((_, i) => (i === 0 ? 'snapshot.json' : 'snapshot-' + (i + 1) + '.json'));
shards.forEach((s, i) => fs.writeFileSync(path.join(root, names[i]), L.text(s)));
for (const f of fs.readdirSync(root)) { // remove shards that are no longer needed
  const m = /^snapshot-(\d+)\.json$/.exec(f);
  if (m && !names.includes(f)) fs.unlinkSync(path.join(root, f));
}

const claims = shards.reduce((n, s) => n + s.claims.length, 0), places = shards.reduce((n, s) => n + s.places.length, 0);
const lines = [
  '### Commons snapshot',
  '',
  '- ' + good.length + ' contribution file' + (good.length === 1 ? '' : 's') + ' merged: ' + claims + ' observation' + (claims === 1 ? '' : 's') + ' at ' + places + ' place' + (places === 1 ? '' : 's') + '.',
  '- Written: ' + names.map(n => '`' + n + '`').join(', ') + (shards.length > 1 ? ' (the commons is large enough to need more than one file; Orient loads one file at a time).' : '.'),
];
if (bad.length) {
  lines.push('- **' + bad.length + ' contribution file' + (bad.length === 1 ? ' was' : 's were') + ' skipped because ' + (bad.length === 1 ? 'it is' : 'they are') + ' not valid:**');
  for (const b of bad) { lines.push('  - `' + b.rel + '`: ' + b.error); console.log('::warning file=' + b.rel + '::Skipped, not a valid contribution: ' + b.error); }
}
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
