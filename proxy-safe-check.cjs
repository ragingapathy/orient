// Errors the server expects (a website that blocks us, an unreachable source) must not use 502, 503 or 504: a reverse proxy replaces
// those answers with its own page and the browser can no longer read the message.   node proxy-safe-check.cjs
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const cp = require('node:child_process');
const path = require('node:path');
(async () => {
  const port = 4600 + Math.floor(Math.random() * 300), dir = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'orient-ps-'));
  const server = cp.spawn(process.execPath, ['server.cjs'], { cwd: __dirname, env: { ...process.env, PORT: String(port), ORIENT_SYNC: 'off', ORIENT_DATA_DIR: dir }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) { try { await fetch('http://127.0.0.1:' + port + '/', { method: 'HEAD' }); break; } catch { await new Promise(r => setTimeout(r, 150)); } }
    const post = async (route, body) => { const r = await fetch('http://127.0.0.1:' + port + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ } return { status: r.status, json, text }; };
    const r1 = await post('/api/website', { url: 'http://127.0.0.1:9/' });          // refused, or blocked as a private address
    assert.ok(![502, 503, 504].includes(r1.status), 'website: status ' + r1.status); assert.ok(r1.json && typeof r1.json.error === 'string' && r1.json.error.length > 5, 'website: a JSON message ' + r1.text.slice(0, 80));
    const r2 = await post('/api/website', { url: 'https://nonexistent-host-for-orient-check.invalid/' });  // cannot be resolved
    assert.ok(![502, 503, 504].includes(r2.status), 'website (unresolvable): status ' + r2.status); assert.ok(r2.json && r2.json.error, 'website (unresolvable): a JSON message');
    assert.ok(r2.status >= 400 && r2.status < 500, 'a client-side style status the proxy leaves alone');
    const r3 = await post('/api/places', { lat: 91, lng: 0 });
    assert.ok(![502, 503, 504].includes(r3.status) && r3.json && r3.json.error, 'places');
    console.log('PASS: expected upstream failures keep their JSON message and avoid 502, 503 and 504');
  } finally { server.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
