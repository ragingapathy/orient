'use strict';
/* Orient orients: it finds where you are, when you ask, and only then.
   It happens twice: when you open the app, and every time you press the compass. Either way the map moves to you and turns
   north-up (pressing the compass also fixes a map you have rotated). There is no tracking and no following: one position is read
   per ask (getCurrentPosition, never watchPosition), shown as a still dot, and left where it is until the next ask.
   The position lives in memory only. It is not saved, synced, exported or sent anywhere. */
window.OrientLocate = (() => {
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TILE = 78271.517;               // metres per pixel at zoom 0 on the equator (512 px tiles)
  const AWAY_MS = 10 * 60 * 1000;       // coming back to the app after this long orients you again
  const STALE_MS = 10 * 60 * 1000;      // a dot this old is drawn faded: it is where you WERE
  let map = null, env = {}, marker = null, el = null, fix = null, running = null, touched = false, staleTimer = 0, hiddenAt = 0, moving = false;

  const compass = () => document.querySelector('[data-action="north"]');
  const say = text => env.toast && env.toast(text);

  function init(m, helpers = {}) {
    map = m; env = helpers; touched = false;
    // If you start moving the map before the first answer arrives, the opening orient leaves your map alone.
    const mark = () => { touched = true; };
    map.getCanvas().addEventListener('pointerdown', mark, { passive: true });
    map.getCanvas().addEventListener('wheel', mark, { passive: true });
    map.on('zoom', sizeRing);
    // Reopening the app after a while away counts as opening it.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) { touched = false; auto(); }
      hiddenAt = 0;
    });
  }

  function busy(on) {
    const b = compass(); if (!b) return;
    b.classList.toggle('locating', on); if (on) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy');
  }

  function problem(error) {
    if (!window.isSecureContext) return 'Location only works on a secure (https) address.';
    switch (error && error.code) {
      case 1: return 'Location is off for Orient. Allow it in your browser’s site settings, then tap the compass again.';
      case 2: return 'Couldn’t find you. Try again with a clearer view of the sky.';
      case 3: return 'Finding you took too long. Tap the compass to try again.';
      default: return 'Your browser can’t share a location.';
    }
  }

  function read(fresh) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject({ code: 0 }); return; }
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: fresh ? 15000 : 12000, maximumAge: fresh ? 0 : 120000 });
    });
  }

  // ---- the dot -----------------------------------------------------------------------------------------------------
  function ensureMarker() {
    if (marker || !map || !window.maplibregl) return;
    el = document.createElement('div'); el.className = 'you-marker'; el.setAttribute('role', 'img');
    el.innerHTML = '<span class="you-ring"></span><span class="you-dot"></span>';
    marker = new maplibregl.Marker({ element: el, anchor: 'center', pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat([0, 0]).addTo(map);
  }
  function sizeRing() {
    if (!el || !fix) return;
    const radius = fix.accuracy / (TILE * Math.cos(fix.lat * Math.PI / 180) / Math.pow(2, map.getZoom()));
    el.style.setProperty('--you-r', Math.min(radius, 600).toFixed(1) + 'px');
    el.classList.toggle('has-ring', fix.accuracy >= 20 && radius > 16);
  }
  function show(position) {
    fix = { lng: position.coords.longitude, lat: position.coords.latitude, accuracy: Math.max(0, position.coords.accuracy || 0), at: Date.now() };
    ensureMarker(); if (!marker) return;
    marker.setLngLat([fix.lng, fix.lat]); el.classList.remove('stale');
    el.setAttribute('aria-label', 'Your location when you last asked, accurate to about ' + Math.round(fix.accuracy) + ' metres');
    sizeRing();
    clearTimeout(staleTimer); staleTimer = setTimeout(() => el && el.classList.add('stale'), STALE_MS);
    if (env.changed) env.changed();
  }

  // Orient remembers the map's last view with your other settings. A view centred on YOU must not be remembered, so every move the
  // compass makes (the instant north-up included, which fires even when nothing changes) is flagged for a moment; the app asks
  // settling() before it saves a view and skips those.
  let settleTimer = 0;
  const settleFor = ms => { moving = true; clearTimeout(settleTimer); settleTimer = setTimeout(() => { moving = false; }, ms); };

  function goTo() {
    if (!map || !fix) return;
    const duration = reduce() ? 0 : 700; settleFor(duration + 400);
    map.easeTo({ center: [fix.lng, fix.lat], zoom: Math.max(map.getZoom(), 15), bearing: 0, pitch: 0, offset: (env.offset && env.offset()) || [0, 0], duration });
  }

  // ---- asking ------------------------------------------------------------------------------------------------------
  // explicit = you pressed the compass: always moves the map, always explains a failure.
  // otherwise it is the opening orient: quiet, and it steps aside if you have already started moving the map.
  async function locate(explicit) {
    if (running) return running;
    running = (async () => {
      busy(true);
      try {
        const position = await read(explicit);
        show(position);
        if (explicit || (!touched && !(env.holding && env.holding()))) goTo();
        return fix;
      } catch (error) {
        if (explicit) say(problem(error));
        return null;
      } finally { busy(false); running = null; }
    })();
    return running;
  }

  // The compass. North comes first, instantly, so the map is never left crooked while it looks for you.
  function press() {
    if (!map) return null;
    settleFor(700);
    map.easeTo({ bearing: 0, pitch: 0, duration: reduce() ? 0 : 300 });
    return locate(true);
  }

  // Opening the app: only once the app is set up (a brand-new map starts with the choose-your-city step, which has its
  // own "current location" button), and never nags if location is blocked.
  async function auto() {
    if (!map || document.hidden || !navigator.geolocation || (env.ready && !env.ready())) return null;
    try { const p = await navigator.permissions?.query({ name: 'geolocation' }); if (p && p.state === 'denied') return null; } catch { /* older browsers: just ask */ }
    return locate(false);
  }

  return { init, auto, press, settling: () => moving, state: () => ({ fix: fix && { ...fix }, hasDot: !!marker, center: map && map.getCenter().toArray(), zoom: map && map.getZoom(), bearing: map && map.getBearing(), busy: !!running }) };
})();
