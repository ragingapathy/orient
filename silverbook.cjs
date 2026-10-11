'use strict';
// Read-only Silverbook bridge: only id, name, address and city are read. Never notes, emails, skills,
// agenda, or anything else in a contact's record, and Silverbook is never written to.
const fs = require('node:fs');

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
    json(res, 200, { connected: true, people: await people(fetcher) });
  } catch {
    json(res, 200, { connected: false, people: [], message: 'Open Silverbook on this computer to link people.' });
  }
}

module.exports = { config, people, handle };
