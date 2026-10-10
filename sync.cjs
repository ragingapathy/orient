'use strict';
// One copy of the map on the computer running Orient, so the desktop and the phone see the same data.
// The copy is a file in data/ (ignored by git). This computer, reached directly, is trusted. Anything arriving
// through the tunnel must carry the pairing key, which is made on first use and shown only on this computer.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const backup = require('./backup.cjs');
const dir = process.env.ORIENT_DATA_DIR || path.join(__dirname, 'data');
const stateFile = path.join(dir, 'orient-state.json');
const tokenFile = path.join(dir, 'sync-token.txt');
const MAX_BYTES = 3 * 1024 * 1024;
let current = null;
let failures = [];

function load() {
  if (current) return current;
  try { current = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { current = { rev: 0, updatedAt: null, state: null }; }
  return current;
}
function writeAtomic(file, text, mode) {
  fs.mkdirSync(dir, { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text, { mode });
  fs.renameSync(tmp, file);
}
function token(renew = false) {
  if (!renew) { try { const t = fs.readFileSync(tokenFile, 'utf8').trim(); if (/^[a-f0-9]{48}$/.test(t)) return t; } catch {} }
  const t = crypto.randomBytes(24).toString('hex');
  writeAtomic(tokenFile, t, 0o600);
  return t;
}
// Trusted means: the connection is from this computer and did not come through the tunnel.
function trusted(req) {
  const addr = req.socket.remoteAddress || '';
  const h = req.headers;
  // In Docker, connections from this computer arrive from the Docker network instead of loopback, so the
  // compose file sets ORIENT_TRUST_LOCAL_HOST=1 and publishes the port on 127.0.0.1 only.
  return (process.env.ORIENT_TRUST_LOCAL_HOST === '1' || ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(addr))
    && !h['cf-connecting-ip'] && !h['cf-ray'] && !h['x-forwarded-for'] && !h['x-forwarded-host']
    && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(h.host || '');
}
function authorized(req) {
  if (trusted(req)) return true;
  const now = Date.now();
  failures = failures.filter(t => now - t < 60000);
  if (failures.length >= 10) return null;
  const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const want = token();
  const ok = given.length === want.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(want));
  if (!ok) failures.push(now);
  return ok;
}
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > MAX_BYTES) throw Object.assign(new Error('big'), { status: 413 }); chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}

// Returns true when the request was one of ours.
function handle(req, res, url, json) {
  if (url !== '/api/state' && !url.startsWith('/api/state/')) return false;
  if (process.env.ORIENT_SYNC === 'off') { json(res, 404, { error: 'Sync is turned off on this server.' }); return true; }
  const local = trusted(req);
  if (url === '/api/state/pair') {
    if (!local) { json(res, 403, { error: 'The pairing key is only shown on the computer that runs Orient.' }); return true; }
    if (req.method === 'POST') { json(res, 200, { token: token(true) }); return true; }
    if (req.method === 'GET') { json(res, 200, { token: token() }); return true; }
    res.writeHead(405, { Allow: 'GET, POST' }); res.end(); return true;
  }
  if (url !== '/api/state') { res.writeHead(404); res.end(); return true; }
  const ok = authorized(req);
  if (ok === null) { json(res, 429, { error: 'Too many wrong keys. Wait a minute.' }); return true; }
  if (!ok) { json(res, 401, { error: 'This browser is not paired with the Orient computer.' }); return true; }
  if (req.method === 'GET') { const s = load(); json(res, 200, { rev: s.rev, updatedAt: s.updatedAt, state: s.state, local }); return true; }
  if (req.method === 'PUT') {
    (async () => {
      try {
        const input = JSON.parse(await readBody(req));
        const st = input && input.state;
        if (!st || typeof st !== 'object' || Array.isArray(st) || st.version !== 1) { json(res, 400, { error: 'That is not an Orient map.' }); return; }
        const s = load();
        if (!Number.isInteger(input.baseRev) || input.baseRev !== s.rev) { json(res, 409, { rev: s.rev, updatedAt: s.updatedAt, state: s.state }); return; }
        backup.beforeWrite(s, st); // keeps a copy of the map as it was if this write shrinks it sharply
        current = { rev: s.rev + 1, updatedAt: new Date().toISOString(), state: st };
        writeAtomic(stateFile, JSON.stringify(current), 0o600);
        json(res, 200, { rev: current.rev, updatedAt: current.updatedAt });
      } catch (e) { if (!res.headersSent) json(res, e.status || 400, { error: e.status === 413 ? 'The map is too large to sync.' : 'Invalid sync request.' }); }
    })();
    return true;
  }
  res.writeHead(405, { Allow: 'GET, PUT' }); res.end(); return true;
}
module.exports = { handle, trusted, token, authorized };
