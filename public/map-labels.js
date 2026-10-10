/* Names on the map, and a hover card on desktop.
   Every pin carries its place's name. Which names are shown is decided here: from a close zoom, in order of
   how much a place matters to you (the selected place, then visited, saved, your own and catalogue places, then
   the rest), skipping any name that would sit on top of another name or on another pin. Hovering a pin (or
   focusing it with the keyboard) shows a small card: name, type, whether it is open, address, your visits. */
'use strict';
window.OrientMapLabels = (() => {
  const MIN_ZOOM = 13;
  const hoverCapable = matchMedia('(hover: hover) and (pointer: fine)');
  let api = null, hooked = null, card = null, frame = 0, showTimer = 0, hideTimer = 0, current = null;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function init(a) { api = a; }

  // ---- which names to show ----
  const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  function layout() {
    frame = 0;
    const map = api && api.map(); if (!map) return;
    hook(map);
    const selected = api.selected(), zoomedIn = map.getZoom() >= MIN_ZOOM, items = [];
    for (const [id, marker] of api.markers()) {
      const el = marker.getElement(), label = el.querySelector('.pin-label'); if (!label) continue;
      items.push({ id, el, label, at: map.project(marker.getLngLat()), priority: api.priority(id) });
    }
    if (!zoomedIn) { for (const it of items) it.label.classList.toggle('on', it.id === selected); return; }
    // measure first, then write, so the browser lays out once
    for (const it of items) it.w = it.label.offsetWidth || 90;
    const pins = items.map(it => ({ id: it.id, l: it.at.x - 22, r: it.at.x + 22, t: it.at.y - 22, b: it.at.y + 22 }));
    const taken = [];
    items.sort((a, b) => b.priority - a.priority || a.label.textContent.localeCompare(b.label.textContent));
    for (const it of items) {
      const box = { l: it.at.x - it.w / 2 - 2, r: it.at.x + it.w / 2 + 2, t: it.at.y + 24, b: it.at.y + 44 };
      const clear = !taken.some(o => hit(box, o)) && !pins.some(p => p.id !== it.id && hit(box, p));
      const show = it.id === selected || clear;
      if (show) taken.push(box);
      it.label.classList.toggle('on', show);
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(layout); };

  // ---- the hover card ----
  function ensureCard(map) {
    if (card && card.isConnected) return card;
    card = document.createElement('div'); card.className = 'hover-card'; card.id = 'hover-card'; card.setAttribute('role', 'tooltip'); card.hidden = true;
    map.getContainer().append(card); return card;
  }
  function cardHtml(id) {
    const i = api.info(id); if (!i) return '';
    const bits = [i.kind, i.saved ? 'Saved' : ''].filter(Boolean).join(' · ');
    return '<strong>' + esc(i.name) + '</strong><span class="hc-kind">' + esc(bits) + '</span>'
      + (i.status ? '<span class="hc-status ' + (/^Open/.test(i.status) ? 'open' : 'closed') + '">' + esc(i.status) + '</span>' : '')
      + (i.address ? '<span class="hc-line">' + esc(i.address) + '</span>' : '')
      + (i.visits ? '<span class="hc-line">' + esc(i.visits) + '</span>' : '')
      + '<span class="hc-hint">Click for details</span>';
  }
  function showCard(id, el) {
    const map = api.map(); if (!map || !hoverCapable.matches) return;
    const c = ensureCard(map), html = cardHtml(id); if (!html) return;
    clearTimeout(hideTimer); current = id; c.innerHTML = html; c.hidden = false; c.style.visibility = 'hidden';
    const box = map.getContainer().getBoundingClientRect(), r = el.getBoundingClientRect(), w = c.offsetWidth, h = c.offsetHeight;
    const x = Math.max(8, Math.min(box.width - w - 8, r.left - box.left + r.width / 2 - w / 2));
    const above = r.top - box.top - h - 8 >= 8;
    c.style.left = x + 'px'; c.style.top = (above ? r.top - box.top - h - 8 : r.bottom - box.top + 8) + 'px'; c.style.visibility = 'visible';
  }
  function hideCard() { clearTimeout(showTimer); clearTimeout(hideTimer); current = null; if (card) card.hidden = true; }
  const markerOf = e => (e.target.closest ? e.target.closest('.map-marker[data-place-id]') : null);

  function hook(map) {
    if (hooked === map) return; hooked = map;
    map.on('moveend', schedule); map.on('zoomend', schedule);
    map.on('movestart', hideCard); map.on('click', hideCard);
    const root = map.getContainer();
    root.addEventListener('mouseover', e => { const m = markerOf(e); if (!m) return; clearTimeout(showTimer); clearTimeout(hideTimer); showTimer = setTimeout(() => showCard(m.dataset.placeId, m), current ? 40 : 160); });
    root.addEventListener('mouseout', e => { if (!markerOf(e)) return; clearTimeout(showTimer); hideTimer = setTimeout(hideCard, 90); });
    root.addEventListener('focusin', e => { const m = markerOf(e); if (m && e.target.matches(':focus-visible')) showCard(m.dataset.placeId, m); });
    root.addEventListener('focusout', e => { if (markerOf(e)) hideCard(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideCard(); });
  }

  return { init, refresh: schedule };
})();
