/* "Directions" opens the maps app you prefer. A web page cannot see which app that is, so there is a setting,
   kept on this device, and an automatic choice for phones. */
'use strict';
window.OrientDirections = (() => {
  const KEY = 'orient-directions-app';
  const APPS = { auto: 'Automatic', apple: 'Apple Maps', google: 'Google Maps', waze: 'Waze', osm: 'OpenStreetMap' };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const get = () => { try { const v = localStorage.getItem(KEY); return APPS[v] ? v : 'auto'; } catch { return 'auto'; } };
  const set = v => { try { localStorage.setItem(KEY, APPS[v] ? v : 'auto'); } catch {} };
  function platform() {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    return 'other';
  }
  // Automatic: Apple Maps on iPhone/iPad; on Android a geo: link, which lets the phone use its own default maps app.
  function resolve(app = get()) {
    if (app !== 'auto') return app;
    const p = platform();
    return p === 'ios' ? 'apple' : p === 'android' ? 'geo' : 'google';
  }
  // coordinates are [lng, lat]; mode is 'driving' or 'walking'
  function url(coordinates, name = '', mode = 'driving', app = get()) {
    const [lng, lat] = coordinates, ll = lat + ',' + lng, walking = mode === 'walking';
    switch (resolve(app)) {
      case 'apple': return 'https://maps.apple.com/?daddr=' + ll + '&dirflg=' + (walking ? 'w' : 'd');
      case 'waze': return 'https://waze.com/ul?ll=' + ll + '&navigate=yes';
      case 'osm': return 'https://www.openstreetmap.org/directions?engine=' + (walking ? 'fossgis_osrm_foot' : 'fossgis_osrm_car') + '&route=%3B' + encodeURIComponent(ll);
      case 'geo': return 'geo:' + ll + '?q=' + ll + '(' + encodeURIComponent(String(name).replace(/[()]/g, ' ').slice(0, 80)) + ')';
      default: return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(ll) + '&travelmode=' + (walking ? 'walking' : 'driving');
    }
  }
  // Attributes for an <a>, so the link can be rewritten if the setting changes while it is on screen.
  const attrs = (coordinates, name, mode) => 'data-dir data-lng="' + esc(coordinates[0]) + '" data-lat="' + esc(coordinates[1]) + '" data-name="' + esc(name) + '" data-mode="' + esc(mode || 'driving') + '" href="' + esc(url(coordinates, name, mode)) + '" target="_blank" rel="noopener noreferrer"';
  function refresh() {
    document.querySelectorAll('a[data-dir]').forEach(a => { a.href = url([Number(a.dataset.lng), Number(a.dataset.lat)], a.dataset.name, a.dataset.mode); });
  }
  function wire() {
    const sel = document.getElementById('dir-app'); if (!sel) return;
    sel.innerHTML = Object.entries(APPS).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('');
    sel.value = get();
    sel.addEventListener('change', () => { set(sel.value); refresh(); });
  }
  // The first time Directions is tapped on a device, ask which app to use (Android's own picker needs no question).
  const decided = () => { try { return localStorage.getItem(KEY) !== null; } catch { return true; } };
  let dlg = null;
  function ask(link) {
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.id = 'dir-dialog'; dlg.setAttribute('aria-labelledby', 'dir-title');
      dlg.addEventListener('click', e => {
        const b = e.target.closest('[data-dir-app]'); if (!b) { if (e.target.closest('[data-dir-cancel]')) dlg.close(); return; }
        set(b.dataset.dirApp); refresh(); const href = dlg.pendingHref; dlg.close();
        const sel = document.getElementById('dir-app'); if (sel) sel.value = get();
        window.open(href, '_blank', 'noopener,noreferrer');
      });
      document.body.append(dlg);
    }
    dlg.pendingHref = null;
    const coords = [Number(link.dataset.lng), Number(link.dataset.lat)];
    dlg.innerHTML = '<h2 id="dir-title">Open directions in…</h2><p class="fine">Your browser can’t tell which maps app you prefer, so choose once. You can change it any time in your field kit.</p><div class="dir-choices">'
      + ['apple', 'google', 'waze', 'osm'].map(k => '<button type="button" class="button" data-dir-app="' + k + '">' + APPS[k] + '</button>').join('')
      + '</div><button type="button" class="quiet" data-dir-cancel>Not now</button>';
    dlg.pendingHref = null;
    // the link to open depends on the app chosen, so compute it at click time
    dlg.querySelectorAll('[data-dir-app]').forEach(b => b.addEventListener('click', () => { dlg.pendingHref = url(coords, link.dataset.name, link.dataset.mode, b.dataset.dirApp); }, true));
    dlg.showModal();
  }
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[data-dir]');
    if (!a || e.defaultPrevented || decided() || platform() === 'android') return;
    e.preventDefault(); ask(a);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  return { url, attrs, get, set, resolve, refresh, apps: APPS };
})();
