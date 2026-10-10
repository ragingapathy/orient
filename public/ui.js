/* Small helpers that give every dialog the same look: an icon tile in the header, and the Field kit's jump bar.
   Nothing here changes what a dialog does. */
'use strict';
(function () {
  // an icon for each dialog, so a header reads at a glance
  const ICONS = {
    'settings-dialog': 'sliders-horizontal', 'add-dialog': 'plus', 'category-dialog': 'tag', 'home-dialog': 'house', 'area-dialog': 'map-pinned',
    'commons-dialog': 'users', 'takeout-dialog': 'map-pinned', 'dir-dialog': 'navigation', 'neighbor-dialog': 'user-round',
    'outing-dialog': 'footprints', 'photo-dialog': 'camera', 'website-dialog': 'globe', 'social-dialog': 'share-2', 'circuit-dialog': 'route', 'circuits-browser': 'route', 'circuit-editor': 'route', 'collections-dialog': 'layers', 'journey-dialog': 'sparkles', 'lore-dialog': 'scroll-text', 'knowledge-dialog': 'notebook-pen',
  };
  function dress(dialog) {
    const head = dialog.querySelector('.panel-heading'); if (!head || head.querySelector('.dlg-ico')) return;
    const name = ICONS[dialog.id] || (dialog.classList.contains('gidgit-settings') ? 'mascot' : null); if (!name) return;
    const tile = document.createElement('span'); tile.className = 'dlg-ico'; tile.innerHTML = name === 'mascot' ? OrientMascot.html('idle', '', true) : '<i data-lucide="' + name + '" aria-hidden="true"></i>';
    head.prepend(tile); if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width': 1.8 }, nameAttr: 'data-lucide' });
  }
  const dressAll = () => document.querySelectorAll('dialog[open]').forEach(dress);
  new MutationObserver(dressAll).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });

  // Field kit: the chips scroll to a section, and the current section's chip is lit
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-set-go]'); if (!b) return;
    const target = document.getElementById(b.dataset.setGo); if (!target) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (target.tagName === 'DETAILS') target.open = true;
  });
  document.addEventListener('scroll', e => {
    const dlg = e.target; if (!dlg || dlg.id !== 'settings-dialog') return;
    const chips = [...dlg.querySelectorAll('[data-set-go]')], top = dlg.getBoundingClientRect().top + 90;
    let current = chips[0];
    for (const c of chips) { const t = document.getElementById(c.dataset.setGo); if (t && !t.hidden && t.getBoundingClientRect().top <= top) current = c; }
    if (dlg.scrollTop + dlg.clientHeight >= dlg.scrollHeight - 8) current = chips[chips.length - 1];
    for (const c of chips) c.setAttribute('aria-current', c === current ? 'true' : 'false');
  }, true);

  // Gidgit: the mascot's mood follows what the dialog is doing, and an idea chip fills the question
  const MOODS = { idle: 'Ask your map. Remember a detail.', thinking: 'Looking through your map…', happy: 'Here’s what I found.', confused: 'Hmm. I couldn’t manage that one.' };
  function gidgitMood(dlg) {
    const stop = dlg.querySelector('[data-gidgit="cancel"]'), status = (dlg.querySelector('[data-gidgit-status]') || {}).textContent || '', result = dlg.querySelector('[data-gidgit-result]');
    const mood = stop && !stop.hidden ? 'thinking' : /could not|couldn.t|failed|unavailable|not reach|error|refused|pair/i.test(status) ? 'confused' : result && result.children.length ? 'happy' : 'idle';
    if (window.OrientMascot) OrientMascot.set(dlg, mood);
    const line = dlg.querySelector('[data-gidgit-line]'); if (line && line.dataset.mood !== mood) { line.dataset.mood = mood; line.textContent = MOODS[mood]; }
  }
  new MutationObserver(() => { const d = document.getElementById('gidgit-dialog'); if (d && d.open) gidgitMood(d); }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true, attributeFilter: ['hidden'] });
  document.addEventListener('click', e => {
    const idea = e.target.closest && e.target.closest('[data-gidgit-idea]'); if (!idea) return;
    const q = document.getElementById('gidgit-query'); if (q) { q.value = idea.dataset.gidgitIdea; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  });

  // Calendar: a day in the week strip jumps to that day; a starter chip fills the quick-add box
  document.addEventListener('click', e => {
    const jump = e.target.closest && e.target.closest('[data-jump]');
    if (jump) { const h = document.getElementById('ag-' + jump.dataset.jump); const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; if (h) h.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); return; }
    const fill = e.target.closest && e.target.closest('[data-fill]');
    if (fill) { const input = document.getElementById('calendar-sentence'); if (input) { input.value = fill.dataset.fill; input.focus(); input.setSelectionRange(input.value.length, input.value.length); input.scrollIntoView({ block: 'center' }); } }
  });
})();
