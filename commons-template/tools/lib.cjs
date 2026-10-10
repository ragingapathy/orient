'use strict';
// Shared pieces for the commons tools: reading contribution files, merging them, and splitting the result
// into snapshots small enough for Orient to load. No dependencies beyond Node 18+ and git.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const D = require('./commons-data.js');

const MAX_FILE = 1024 * 1024; // Orient refuses larger files
// Orient accepts at most 50 sources, 200 places, 500 claims and 1 MB per bundle. Stay under with some room.
const CAPS = { sources: 45, places: 180, claims: 450, bytes: 900 * 1024 };
const FILE_PATTERN = /^contributions\/[a-z0-9][a-z0-9._-]*\.json$/;

const git = (args, cwd) => cp.execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

// Contribution files, oldest first, by when each first reached the git history. A later file may correct
// or retire an earlier claim, so order matters. Files git has not seen sort last, by name.
function contributionFiles(root) {
  let names = [];
  try { names = fs.readdirSync(path.join(root, 'contributions')).filter(n => FILE_PATTERN.test('contributions/' + n)); } catch { /* none yet */ }
  const files = names.map(n => 'contributions/' + n);
  let log = '';
  try { log = git(['log', '--reverse', '--diff-filter=A', '--name-only', '--format=', '--', 'contributions'], root); } catch { /* not a git checkout */ }
  const rank = new Map(); let i = 0;
  for (const line of log.split('\n')) { const f = line.trim(); if (f && !rank.has(f)) rank.set(f, i++); }
  return files.sort((a, b) => (rank.has(a) ? rank.get(a) : 1e9) - (rank.has(b) ? rank.get(b) : 1e9) || a.localeCompare(b));
}

// -> { bundle } or { error }
function readBundle(root, rel) {
  try {
    const full = path.join(root, rel);
    if (fs.statSync(full).size > MAX_FILE) return { error: 'The file is larger than 1 MB.' };
    return { bundle: D.validate(JSON.parse(fs.readFileSync(full, 'utf8'))) };
  } catch (e) { return { error: e.message }; }
}

// Later bundles win for the same source, place or claim identity, which is how a claim gets corrected or retired.
function merge(bundles) {
  const sources = new Map(), places = new Map(), claims = new Map();
  for (const b of bundles) {
    for (const s of b.sources) sources.set(s.id, s);
    for (const p of b.places) places.set(D.sourceKey(p.source_id, p.id), p);
    for (const c of b.claims) claims.set(D.sourceKey(c.source_id, c.claim.id), c);
  }
  return { sources, places, claims };
}

const text = value => JSON.stringify(value, null, 2) + '\n';

// Split a merge into bundles that each fit Orient's limits. Whole places move together with their claims.
function shard(merged) {
  const byPlace = new Map();
  for (const entry of merged.claims.values()) {
    const key = D.sourceKey(entry.source_id, entry.claim.place_id);
    if (!merged.places.has(key)) continue; // a claim whose place vanished cannot be shown
    if (!byPlace.has(key)) byPlace.set(key, []);
    byPlace.get(key).push(entry);
  }
  const keys = [...byPlace.keys()].sort();
  const shards = [];
  let cur = null;
  const fresh = () => ({ sources: new Map(), places: [], claims: [], bytes: 0 });
  for (const key of keys) {
    const place = merged.places.get(key);
    const claims = byPlace.get(key).sort((a, b) => a.claim.asserted_on.localeCompare(b.claim.asserted_on) || a.claim.id.localeCompare(b.claim.id));
    const source = merged.sources.get(place.source_id);
    const size = JSON.stringify(place).length + claims.reduce((n, c) => n + JSON.stringify(c).length, 0) + 800;
    if (cur && (cur.places.length + 1 > CAPS.places || cur.claims.length + claims.length > CAPS.claims
      || (!cur.sources.has(source.id) && cur.sources.size + 1 > CAPS.sources) || cur.bytes + size > CAPS.bytes)) { shards.push(cur); cur = null; }
    if (!cur) cur = fresh();
    cur.sources.set(source.id, source); cur.places.push(place); cur.claims.push(...claims); cur.bytes += size;
  }
  if (cur) shards.push(cur);
  if (!shards.length) shards.push(fresh());
  return shards.map(s => D.validate({
    format: 'orient-commons', schema_version: 1,
    sources: [...s.sources.values()].sort((a, b) => a.id.localeCompare(b.id)), places: s.places, claims: s.claims,
  }));
}

module.exports = { D, CAPS, FILE_PATTERN, MAX_FILE, git, contributionFiles, readBundle, merge, shard, text };
