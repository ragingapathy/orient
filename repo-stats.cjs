#!/usr/bin/env node
'use strict';
// Records GitHub's traffic numbers (clones, page views, stars, forks) for the project's repositories.
// GitHub only keeps the last 14 days and only shows them to the repository owner, so this keeps a history in
// data/repo-stats.json (ignored by git). Orient shows it in Your field kit, on this computer only.
//
//   node repo-stats.cjs                     # fetch, archive, print
//   node repo-stats.cjs --show              # print the archive without fetching
//   ORIENT_STATS_REPOS=owner/a,owner/b node repo-stats.cjs
//
// It uses GITHUB_TOKEN if set, otherwise the GitHub login git already has stored. The token is never printed
// or saved. Run it at least every two weeks so no days are missed.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const DEFAULT_REPOS = ['ragingapathy/orient', 'ragingapathy/toledo-commons'];
const dataDir = process.env.ORIENT_DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(dataDir, 'repo-stats.json');

const day = ts => String(ts).slice(0, 10);
const num = v => (Number.isFinite(v) ? v : 0);

// Pure: fold one repository's fresh numbers into the archive. Days GitHub still reports are overwritten (the
// newest day fills in as the day goes on); days that have fallen out of GitHub's window are kept.
function merge(archive, repo, fresh, now = new Date()) {
  const next = { updatedAt: now.toISOString(), repos: { ...(archive && archive.repos) } };
  const prev = next.repos[repo] || { days: {} };
  const days = { ...prev.days };
  for (const c of (fresh.clones && fresh.clones.clones) || []) days[day(c.timestamp)] = { ...(days[day(c.timestamp)] || {}), clones: num(c.count), uniqueCloners: num(c.uniques) };
  for (const v of (fresh.views && fresh.views.views) || []) days[day(v.timestamp)] = { ...(days[day(v.timestamp)] || {}), views: num(v.count), uniqueViewers: num(v.uniques) };
  next.repos[repo] = {
    updatedAt: now.toISOString(),
    stars: num(fresh.stars), forks: num(fresh.forks), watchers: num(fresh.watchers),
    window: { clones: num(fresh.clones && fresh.clones.count), uniqueCloners: num(fresh.clones && fresh.clones.uniques), views: num(fresh.views && fresh.views.count), uniqueViewers: num(fresh.views && fresh.views.uniques) },
    days: Object.fromEntries(Object.entries(days).sort(([a], [b]) => a.localeCompare(b))),
  };
  return next;
}

// Pure: a short summary of one archived repository.
function summarize(entry) {
  const days = Object.entries(entry.days || {});
  const total = key => days.reduce((n, [, d]) => n + num(d[key]), 0);
  return { stars: entry.stars, forks: entry.forks, window: entry.window, clones: total('clones'), views: total('views'), since: days.length ? days[0][0] : null, days: days.length };
}

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const r = cp.spawnSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
  const m = /^password=(.+)$/m.exec(r.stdout || '');
  if (!m) throw new Error('No GitHub login found. Set GITHUB_TOKEN, or sign in to git with GitHub.');
  return m[1].trim();
}

async function fetchRepo(repo, t, fetcher = fetch) {
  const get = async route => {
    const r = await fetcher('https://api.github.com/repos/' + repo + route, { headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'orient-repo-stats' } });
    if (r.status === 404) throw new Error('not found, or no access to its traffic');
    if (r.status === 403) throw new Error('GitHub refused (traffic is visible only to people with push access)');
    if (!r.ok) throw new Error('GitHub answered ' + r.status);
    return r.json();
  };
  const info = await get('');
  const [clones, views] = await Promise.all([get('/traffic/clones'), get('/traffic/views')]);
  return { stars: info.stargazers_count, forks: info.forks_count, watchers: info.subscribers_count, clones, views };
}

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { repos: {} }; } }
function save(archive) { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(FILE + '.tmp', JSON.stringify(archive, null, 2) + '\n'); fs.renameSync(FILE + '.tmp', FILE); }

function table(archive) {
  const rows = [['Repository', 'Clones, last 14 days', 'Unique cloners', 'Views, last 14 days', 'Stars', 'Forks', 'Clones recorded since']];
  for (const [repo, entry] of Object.entries(archive.repos || {})) {
    const s = summarize(entry);
    rows.push([repo, String(s.window.clones), String(s.window.uniqueCloners), String(s.window.views), String(s.stars), String(s.forks), s.since ? s.clones + ' since ' + s.since : '-']);
  }
  const w = rows[0].map((_, i) => Math.max(...rows.map(r => r[i].length)));
  return rows.map(r => r.map((c, i) => c.padEnd(w[i])).join('  ').trimEnd()).join('\n');
}

module.exports = { merge, summarize, table, fetchRepo, FILE };

if (require.main === module) (async () => {
  let archive = load();
  if (!process.argv.includes('--show')) {
    const repos = (process.env.ORIENT_STATS_REPOS || DEFAULT_REPOS.join(',')).split(',').map(s => s.trim()).filter(Boolean);
    const t = token();
    for (const repo of repos) {
      try { archive = merge(archive, repo, await fetchRepo(repo, t)); }
      catch (e) { console.error(repo + ': ' + e.message); }
    }
    save(archive);
  }
  if (!Object.keys(archive.repos || {}).length) { console.log('Nothing recorded yet.'); return; }
  console.log(table(archive));
  console.log('\nGitHub counts git clones, including bots, mirrors, security scanners and your own machines, so read these as a rough signal, not a head count.');
  console.log('GitHub keeps 14 days; this archive (' + FILE + ') keeps the rest. Run it at least every two weeks.');
})().catch(e => { console.error(e.message); process.exit(1); });
