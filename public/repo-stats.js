/* Project stats: GitHub clone counts for the project's repositories, from the archive that `node repo-stats.cjs`
   keeps. Shown in Your field kit only on the computer that runs Orient; everywhere else the server refuses and
   nothing appears. */
'use strict';
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => (Number.isFinite(v) ? v : 0);
  async function show() {
    const box = document.getElementById('stats-box'); if (!box) return;
    box.hidden = true;
    try {
      const res = await fetch('/api/repo-stats', { cache: 'no-store' }); if (!res.ok) return;
      const data = await res.json(), repos = Object.entries(data.repos || {}); if (!repos.length) return;
      const rows = repos.map(([name, e]) => {
        const days = Object.entries(e.days || {}), total = days.reduce((n, [, d]) => n + num(d.clones), 0), w = e.window || {};
        return '<tr><td>' + esc(name.split('/').pop()) + '<small>' + num(e.stars) + ' star' + (num(e.stars) === 1 ? '' : 's') + ' · ' + num(e.forks) + ' fork' + (num(e.forks) === 1 ? '' : 's') + '</small></td>'
          + '<td>' + num(w.clones) + '<small>' + num(w.uniqueCloners) + ' unique</small></td>'
          + '<td>' + total + (days.length ? '<small>since ' + esc(days[0][0]) + '</small>' : '') + '</td></tr>';
      }).join('');
      box.innerHTML = '<header><span class="set-ico"><i data-lucide="chart-line"></i></span><div><h3>Project stats</h3><small>GitHub clone counts, kept on this computer</small></div></header><table class="stats-table"><thead><tr><th>Repository</th><th>Clones, 14 days</th><th>Recorded</th></tr></thead><tbody>' + rows + '</tbody></table>'
        + '<p class="fine">GitHub’s clone counts include bots, mirrors, security scanners and your own machines, so they are a rough signal, not a head count. Updated ' + esc(String(data.updatedAt || '').slice(0, 10) || 'never') + '. Run <code>node repo-stats.cjs</code> to refresh.</p>';
      box.hidden = false; if (window.lucide) lucide.createIcons();
    } catch { /* leave it hidden */ }
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-action="settings"]')) show(); });
})();
