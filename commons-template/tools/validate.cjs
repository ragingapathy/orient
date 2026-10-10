#!/usr/bin/env node
'use strict';
// Checks a contribution pull request. Fails on anything that is not a valid, append-only contribution;
// warns (without failing) about things a maintainer should look at before merging.
//   node tools/validate.cjs --base origin/main        (what the workflow runs)
//   node tools/validate.cjs contributions/file.json   (check files directly)
const fs = require('node:fs');
const path = require('node:path');
const L = require('./lib.cjs');
const D = L.D;

const root = process.cwd();
const args = process.argv.slice(2);
const baseAt = args.indexOf('--base');
const errors = [], warnings = [], added = [];

function note(list, file, message) { list.push({ file, message }); console.log('::' + (list === errors ? 'error' : 'warning') + (file ? ' file=' + file : '') + '::' + message.replace(/\r?\n/g, ' ')); }

// 1. which files does this change touch?
let changes = [];
if (baseAt >= 0) {
  const out = L.git(['diff', '--name-status', '--no-renames', args[baseAt + 1] + '...HEAD'], root);
  changes = out.split('\n').filter(Boolean).map(l => { const [status, ...rest] = l.split('\t'); return { status: status[0], file: rest.join('\t') }; });
} else {
  changes = args.filter(a => !a.startsWith('--')).map(f => ({ status: 'A', file: f.replace(/\\/g, '/') }));
}
if (!changes.length) note(errors, '', 'This pull request does not change any files.');

for (const c of changes) {
  if (!L.FILE_PATTERN.test(c.file)) { note(errors, c.file, 'A contribution should only add files under contributions/. Move other changes to a separate pull request.'); continue; }
  if (c.status !== 'A') { note(errors, c.file, 'Contributions are append-only. To correct or retire an observation, add a new contribution file that repeats its id with the new text or status.'); continue; }
  added.push(c.file);
}

// 2. each added file must be a valid public bundle
const bundles = new Map();
for (const f of added) {
  const r = L.readBundle(root, f);
  if (r.error) { note(errors, f, r.error); continue; }
  if (!r.bundle.claims.length) { note(errors, f, 'This contribution has no observations.'); continue; }
  bundles.set(f, r.bundle);
}

// 3. things worth a human look: private details in the text, and changes to what is already published
const PERSONAL = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/, 'looks like an email address'],
  [/(?:\+?\d[\s().-]?){10,}/, 'looks like a phone number'],
  [/\b(my|our)\s+(neighbou?r|landlord|boss|coworker|co-worker|roommate|ex|wife|husband|partner|girlfriend|boyfriend|son|daughter|kid)\b/i, 'may describe a specific person'],
];
const others = L.contributionFiles(root).filter(f => !added.includes(f));
const existing = L.merge(others.map(f => L.readBundle(root, f).bundle).filter(Boolean));
const rows = [];
for (const [f, b] of bundles) {
  for (const entry of b.claims) {
    const c = entry.claim, key = D.sourceKey(entry.source_id, c.id);
    const place = b.places.find(p => p.source_id === entry.source_id && p.id === c.place_id);
    for (const [re, why] of PERSONAL) if (re.test(c.observation)) note(warnings, f, 'Observation "' + c.id + '" ' + why + '. Check it describes a place, not a person.');
    const before = existing.claims.get(key);
    if (before) note(warnings, f, 'Observation "' + c.id + '" from source "' + entry.source_id + '" already exists and would be replaced (status ' + before.claim.status + ' -> ' + c.status + '). Confirm this is the same contributor.');
    const oldPlace = existing.places.get(D.sourceKey(entry.source_id, c.place_id));
    if (oldPlace && D.same(oldPlace.coordinates, place.coordinates) === false) note(warnings, f, 'Place "' + place.id + '" would move to a new map pin.');
    rows.push({ f, place, c, source: entry.source_id, replaces: !!before });
  }
}

// 4. a summary a maintainer can review on the Checks tab
const esc = s => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const lines = ['### Contribution check', ''];
if (errors.length) lines.push('**Not ready to merge:**', '', ...errors.map(e => '- ' + (e.file ? '`' + e.file + '`: ' : '') + e.message), '');
else lines.push('Valid. ' + rows.length + ' observation' + (rows.length === 1 ? '' : 's') + ' in ' + bundles.size + ' file' + (bundles.size === 1 ? '' : 's') + '.', '');
if (warnings.length) lines.push('**For the maintainer to look at:**', '', ...warnings.map(w => '- ' + w.message), '');
if (rows.length) {
  lines.push('| Place | Pin | Observation | Source |', '|---|---|---|---|');
  for (const r of rows) {
    const [lng, lat] = r.place.coordinates;
    lines.push('| ' + esc(r.place.name) + ' | [' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '](https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lng + '#map=18/' + lat + '/' + lng + ') | ' + esc(r.c.observation) + (r.replaces ? ' *(replaces an existing observation)*' : '') + ' | ' + esc(r.source) + ' |');
  }
}
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
process.exit(errors.length ? 1 : 0);
