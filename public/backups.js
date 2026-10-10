/* Backups: when the Orient computer last made a good copy of the map, a Back up now button, and the list of
   copies. Shown in Your field kit only on the computer that runs Orient; elsewhere the server refuses and
   nothing appears. */
'use strict';
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kb = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const ago = iso => {
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 90) return 'just now'; if (s < 5400) return Math.round(s / 60) + ' minutes ago'; if (s < 129600) return Math.round(s / 3600) + ' hours ago'; return Math.round(s / 86400) + ' days ago';
  };
  const clock = w => w.replace('T', ' ').replace(/(\d\d)-(\d\d)-(\d\d)Z$/, '$1:$2:$3 UTC');
  const label = f => f.kind === 'daily' ? f.when : (f.kind === 'before-change' ? 'Before a large change · ' : 'Before a restore · ') + clock(f.when);
  let message = '';

  async function load() {
    const res = await fetch('/api/backups', { cache: 'no-store' });
    return res.ok ? res.json() : null;
  }
  function paint(box, data) {
    const good = data.lastGood, c = data.counts;
    box.dataset.state = good ? 'ok' : 'offline';
    box.innerHTML = '<span class="set-kicker">Backups</span>'
      + '<p class="ui-status" id="backup-line" role="status">' + (good ? 'Last good backup <strong>' + esc(ago(good.modified)) + '</strong> · ' + esc(kb(good.bytes)) + ', ' + good.items + ' saved places and visits.' : 'No backup yet.')
      + (data.backups.some(b => !b.ok) ? ' <strong>Some copies could not be read.</strong>' : '') + '</p>'
      + '<p class="fine">' + c.daily + ' daily cop' + (c.daily === 1 ? 'y' : 'ies') + (c.extra ? ' and ' + c.extra + ' safety cop' + (c.extra === 1 ? 'y' : 'ies') : '') + ' kept on this computer, in <code>data/backups</code>. Today’s copy refreshes each hour while the map changes; a safety copy is made before any large deletion.</p>'
      + '<div class="settings-actions"><button class="button" type="button" data-backup="now">Back up now</button></div>'
      + (message ? '<p class="fine" role="status">' + esc(message) + '</p>' : '')
      + (data.backups.length ? '<details class="fold"><summary><span>All copies</span><small>' + data.backups.length + '</small><i data-lucide="chevron-down"></i></summary><ul class="backup-list">'
        + data.backups.map(b => '<li><span>' + esc(label(b)) + '</span><small>' + esc(kb(b.bytes)) + (b.ok ? '' : ' · unreadable') + '</small></li>').join('') + '</ul></details>' : '')
      + '<p class="fine">To restore one, see Backups in the user guide (<code>node restore-backup.cjs</code>).</p>';
    box.hidden = false; if (window.lucide) lucide.createIcons();
  }
  async function show() {
    const box = document.getElementById('backup-box'); if (!box) return;
    box.hidden = true;
    try { const data = await load(); if (data) paint(box, data); } catch { /* leave it hidden */ }
  }
  document.addEventListener('click', async e => {
    if (e.target.closest && e.target.closest('[data-action="settings"]')) { message = ''; show(); return; }
    const b = e.target.closest && e.target.closest('[data-backup="now"]'); if (!b) return;
    b.disabled = true;
    try {
      const res = await fetch('/api/backups', { method: 'POST' }), body = await res.json();
      message = res.ok ? 'Backed up.' : (body.error || 'The backup did not work.');
    } catch { message = 'The Orient computer could not be reached.'; }
    await show();
  });
})();
