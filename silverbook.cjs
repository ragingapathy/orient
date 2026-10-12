'use strict';
// Read-only Silverbook bridge: only id, name, address and city are read. Never notes, emails, skills,
// agenda, or anything else in a contact's record, and Silverbook is never written to.
const fs = require('node:fs');
const path = require('node:path');

// Off unless this installation turns it on. Silverbook is a private address book that most Orient users do not have, so by
// default nothing about it appears in the app and nothing here ever looks for it. Turn it on with ORIENT_SILVERBOOK=1, or by
// putting {"silverbook": true} in data/local-features.json (that folder is private to this computer and never published).
function enabled() {
  if (/^(1|true|on|yes)$/i.test(process.env.ORIENT_SILVERBOOK || '')) return true;
  try { return JSON.parse(fs.readFileSync(path.join(process.env.ORIENT_DATA_DIR || path.join(__dirname, 'data'), 'local-features.json'), 'utf8')).silverbook === true; } catch { return false; }
}

function config() {
  const base = process.env.ORIENT_SILVERBOOK_URL || (fs.existsSync('/.dockerenv') ? 'http://host.docker.internal:3026' : 'http://127.0.0.1:3026');
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'].includes(url.hostname) || url.username || url.password) {
    throw new Error('Silverbook requires a local address.');
  }
  return url;
}

async function people(fetcher = fetch) {
  const res = await fetcher(new URL('/api/state', config()), { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('Silverbook could not be read.');
  const data = await res.json();
  return (Array.isArray(data.people) ? data.people : [])
    .map(p => ({
      id: String(p?.id || '').slice(0, 100),
      name: String(p?.name || '').slice(0, 150),
      address: String(p?.address || '').slice(0, 250),
      city: String(p?.city || '').slice(0, 100),
    }))
    .filter(p => p.id && p.name)
    .slice(0, 2000);
}

async function handle(req, res, json, fetcher = fetch) {
  if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return; }
  try {
    json(res, 200, { enabled: true, connected: true, people: await people(fetcher) });
  } catch {
    json(res, 200, { enabled: true, connected: false, people: [], message: 'Open Silverbook on this computer to link people.' });
  }
}

module.exports = { enabled, config, people, handle };
