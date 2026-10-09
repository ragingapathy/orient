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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  return { url, attrs, get, set, resolve, refresh, apps: APPS };
})();
