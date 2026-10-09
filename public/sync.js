/* Keeps one map across devices. The copy lives on the computer that runs Orient; each browser keeps its own
   copy as well, so everything still works offline. Changes are merged, not overwritten. */
'use strict';
(function (root) {
  // ---- merging (pure, tested in sync-check.cjs) ----
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  const same = (a, b) => canon(a) === canon(b);
  const keyOf = v => (v && typeof v === 'object' && typeof v.id === 'string') ? 'id:' + v.id : 'v:' + canon(v);
  const plain = v => v && typeof v === 'object' && !Array.isArray(v);

  // Three-way merge of two edited copies of the same JSON against the copy they started from.
  // If only one side changed, that side wins whole. If both changed: lists are combined (an item removed
  // on either side stays removed unless the other side edited it), objects merge key by key,
  // and for a single value changed on both sides, `mine` wins (`theirs` on a first connection).
  function merge(base, mine, theirs, first) {
    if (same(mine, theirs)) return mine;
    if (base !== undefined && same(mine, base)) return theirs;
    if (base !== undefined && same(theirs, base)) return mine;
    if (Array.isArray(mine) && Array.isArray(theirs)) {
      const b = Array.isArray(base) ? base : [];
      const map = list => new Map(list.map(v => [keyOf(v), v]));
      const bm = map(b), mm = map(mine), tm = map(theirs), seen = new Set(), out = [];
      for (const [k, v] of [...tm, ...mm]) {
        if (seen.has(k)) continue; seen.add(k);
        const inB = bm.has(k), inM = mm.has(k), inT = tm.has(k);
        if (inM && inT) { out.push(merge(bm.get(k), mm.get(k), tm.get(k), first)); continue; }
        if (inB) { // removed on one side: keep it only if the other side changed it
          const other = inM ? mm.get(k) : tm.get(k);
          if (!same(other, bm.get(k))) out.push(other);
          continue;
        }
        out.push(v);
      }
      return out;
    }
    if (plain(mine) && plain(theirs)) {
      const b = plain(base) ? base : {}, out = {};
      for (const k of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
        const inM = k in mine, inT = k in theirs, inB = k in b;
        if (inM && inT) { out[k] = merge(b[k], mine[k], theirs[k], first); continue; }
        if (inB) { const other = inM ? mine[k] : theirs[k]; if (!same(other, b[k])) out[k] = other; continue; }
        out[k] = inM ? mine[k] : theirs[k];
      }
      return out;
    }
    return first ? theirs : mine;
  }

  const api = { merge, same, canon };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---- browser side ----
  const META = 'orient-sync-v1', PUBLIC = 'orient-sync-address';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isLocal = () => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname);
  let host = null, busy = false, again = false, timer = null, status = { kind: 'idle' }, shownKey = null;

  const readMeta = () => { try { return JSON.parse(localStorage.getItem(META)) || {}; } catch { return {}; } };
  const writeMeta = m => { try { localStorage.setItem(META, JSON.stringify(m)); } catch {} };
  const setStatus = (kind, extra = {}) => { status = { kind, at: Date.now(), ...extra }; paint(); };

  async function call(method, body) {
    const meta = readMeta(), headers = {};
    if (meta.token) headers.Authorization = 'Bearer ' + meta.token;
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch('/api/state', { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    let data = {}; try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }

  async function run() {
    if (busy) { again = true; return; }
    busy = true; again = false;
    try {
      setStatus('syncing');
      for (let tries = 0; tries < 4; tries++) {
        const got = await call('GET');
        if (got.status === 401 || got.status === 429) { setStatus('unpaired', { message: got.data.error }); return; }
        if (got.status !== 200) { setStatus('offline'); return; }
        const remote = got.data.state, meta = readMeta();
        let mine = host.get();
        if (remote && same(mine, remote)) { writeMeta({ ...meta, rev: got.data.rev, base: mine }); setStatus('ok'); return; }
        let merged = mine;
        if (remote) {
          merged = merge(meta.base, mine, remote, !meta.base);
          if (!same(merged, mine)) { await host.apply(merged); mine = host.get(); merged = mine; }
          if (same(merged, remote)) { writeMeta({ ...meta, rev: got.data.rev, base: merged }); setStatus('ok'); return; }
        }
        const put = await call('PUT', { baseRev: got.data.rev, state: merged });
        if (put.status === 200) { writeMeta({ ...meta, rev: put.data.rev, base: merged }); setStatus('ok'); return; }
        if (put.status !== 409) { setStatus(put.status === 401 ? 'unpaired' : 'offline', { message: put.data.error }); return; }
      }
      setStatus('offline', { message: 'Two devices kept changing the map at once. It will try again.' });
    } catch { setStatus('offline'); }
    finally { busy = false; if (again) setTimeout(run, 300); }
  }
  const soon = (ms = 1500) => { clearTimeout(timer); timer = setTimeout(run, ms); };

  function init(h) {
    host = h;
    // pairing link: https://your-address/#pair=KEY
    const m = /[#&]pair=([a-f0-9]{48})/.exec(location.hash);
    if (m) { writeMeta({ ...readMeta(), token: m[1], base: null, rev: 0 }); history.replaceState(null, '', location.pathname + location.search); }
    if (!isLocal() && !readMeta().token) { setStatus('unpaired'); } else run();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && (isLocal() || readMeta().token)) soon(300); });
    addEventListener('online', () => soon(300));
    setInterval(() => { if (document.visibilityState === 'visible' && (isLocal() || readMeta().token)) run(); }, 60000);
    document.addEventListener('click', onClick);
  }
  function changed() { if (host && (isLocal() || readMeta().token)) soon(); }

  // ---- the "Sync" part of the field kit ----
  const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 10 ? 'just now' : s < 90 ? s + ' seconds ago' : Math.round(s / 60) + ' minutes ago'; };
  function line() {
    const k = status.kind;
    if (k === 'syncing') return 'Syncing…';
    if (k === 'ok') return 'In sync · ' + ago(status.at);
    if (k === 'offline') return (status.message || 'The Orient computer can’t be reached right now.') + ' Your changes are kept here and will sync when it can.';
    if (k === 'unpaired') return status.message || 'This browser isn’t paired yet.';
    return '';
  }
  function markup() {
    const local = isLocal(), paired = !!readMeta().token;
    let h = '<h3>Sync</h3><p class="fine" id="sync-line" role="status">' + esc(line()) + '</p>';
    if (local) {
      h += '<p class="fine">This computer keeps the one copy of your map. Other devices sync to it, so it has to be on and reachable for them to update.</p>';
      h += '<div class="settings-actions"><button class="button" type="button" data-sync="now">Sync now</button><button class="button" type="button" data-sync="show">Pair a phone</button></div>';
      if (shownKey) {
        const addr = (() => { try { return localStorage.getItem(PUBLIC) || ''; } catch { return ''; } })();
        const link = addr ? addr.replace(/\/+$/, '') + '/#pair=' + shownKey : '';
        h += '<div class="sync-pair"><label>Address of Orient on your phone<input id="sync-address" inputmode="url" placeholder="https://…" value="' + esc(addr) + '"></label>'
          + '<p class="fine">Open this link once on the phone. Anyone who has it can read and change your map, so send it only to yourself.</p>'
          + '<input id="sync-link" readonly value="' + esc(link || 'Enter the address above') + '" aria-label="Pairing link"><label>Key only<input id="sync-key" readonly value="' + esc(shownKey) + '"></label>'
          + '<div class="settings-actions"><button class="button" type="button" data-sync="copy">Copy link</button><button class="button" type="button" data-sync="renew">Make a new key</button></div>'
          + '<p class="fine">A new key disconnects every phone until it is paired again.</p></div>';
      }
    } else if (paired) {
      h += '<div class="settings-actions"><button class="button" type="button" data-sync="now">Sync now</button><button class="button" type="button" data-sync="unpair">Unpair this browser</button></div>';
    } else {
      h += '<p class="fine">The key is shown only on the computer that runs Orient, and only when you open Orient there directly at http://127.0.0.1:4173 (not through this public address). Open Your field kit there, choose Pair a phone, and open the link it gives you on this device. Or paste the key here.</p>'
        + '<label>Pairing key<input id="sync-paste" autocomplete="off" spellcheck="false" placeholder="48 characters"></label>'
        + '<div class="settings-actions"><button class="button" type="button" data-sync="pair">Pair this browser</button></div>';
    }
    return h;
  }
  function paint() {
    const box = document.getElementById('sync-box'); if (!box) return;
    const lineEl = document.getElementById('sync-line');
    if (lineEl && box.dataset.shown === (isLocal() ? 'l' : readMeta().token ? 'p' : 'u') + (shownKey ? 'k' : '')) lineEl.textContent = line();
    else render();
  }
  function render() {
    const box = document.getElementById('sync-box'); if (!box) return;
    box.innerHTML = markup(); box.dataset.shown = (isLocal() ? 'l' : readMeta().token ? 'p' : 'u') + (shownKey ? 'k' : '');
    if (window.lucide) lucide.createIcons();
  }
  async function onClick(e) {
    const b = e.target.closest && e.target.closest('[data-sync]'); if (!b) return;
    const act = b.dataset.sync;
    if (act === 'now') { run(); return; }
    if (act === 'show') {
      const r = await fetch('/api/state/pair', { cache: 'no-store' });
      if (r.ok) { shownKey = (await r.json()).token; render(); }
      return;
    }
    if (act === 'renew') {
      if (!confirm('Make a new key? Phones paired with the old one will stop syncing until you pair them again.')) return;
      const r = await fetch('/api/state/pair', { method: 'POST', cache: 'no-store' });
      if (r.ok) { shownKey = (await r.json()).token; render(); }
      return;
    }
    if (act === 'copy') {
      const el = document.getElementById('sync-link'), addr = document.getElementById('sync-address');
      try { localStorage.setItem(PUBLIC, addr.value.trim()); } catch {}
      render();
      const v = document.getElementById('sync-link').value;
      try { await navigator.clipboard.writeText(v); document.getElementById('sync-line').textContent = 'Link copied.'; } catch { document.getElementById('sync-link').select(); }
      return;
    }
    if (act === 'pair') {
      const v = (document.getElementById('sync-paste').value || '').trim().replace(/^.*pair=/, '');
      if (!/^[a-f0-9]{48}$/.test(v)) { document.getElementById('sync-line').textContent = 'That doesn’t look like a pairing key.'; return; }
      writeMeta({ token: v, base: null, rev: 0 }); render(); run(); return;
    }
    if (act === 'unpair') { writeMeta({}); setStatus('unpaired'); render(); }
  }
  document.addEventListener('input', e => {
    if (e.target && e.target.id === 'sync-address' && shownKey) {
      try { localStorage.setItem(PUBLIC, e.target.value.trim()); } catch {}
      const a = e.target.value.trim().replace(/\/+$/, ''); document.getElementById('sync-link').value = a ? a + '/#pair=' + shownKey : 'Enter the address above';
    }
  });

  root.OrientSync = { init, changed, now: run, render, status: () => status, merge, same };
})(typeof window !== 'undefined' ? window : globalThis);
