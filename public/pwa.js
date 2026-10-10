'use strict';
/* Orient as an app: registers the service worker (sw.js), offers "Install Orient" in the field kit, and says whether the app
   is ready to open without a connection. Nothing here sends anything anywhere. */
window.OrientPWA = (() => {
  let deferred = null;
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const secure = () => location.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const ready = () => !!(navigator.serviceWorker && navigator.serviceWorker.controller);

  function register() {
    if (!('serviceWorker' in navigator) || !secure()) return;
    navigator.serviceWorker.register('./sw.js').catch(() => { /* the app works the same without it */ });
    navigator.serviceWorker.addEventListener('controllerchange', render);
  }
  const offlineText = () => ready() ? 'Ready offline: the app and the map areas you have viewed are saved on this device.' : secure() ? 'Getting ready for offline use…' : 'Offline use needs a secure (https) address.';
  function render() {
    const card = document.getElementById('set-devices'); if (!card) return;
    let row = document.getElementById('pwa-row');
    if (!row) {
      row = document.createElement('div'); row.id = 'pwa-row'; row.className = 'set-row';
      row.innerHTML = '<div><b data-pwa-title>Install Orient</b><span data-pwa-text></span></div><button type="button" class="button" data-pwa="install" hidden>Install</button>';
      card.append(row);
    }
    const title = row.querySelector('[data-pwa-title]'), text = row.querySelector('[data-pwa-text]'), btn = row.querySelector('[data-pwa=install]');
    btn.hidden = !deferred;
    if (standalone()) { title.textContent = 'Orient is installed'; text.textContent = 'You are using it as an app. ' + offlineText(); }
    else if (deferred) { title.textContent = 'Install Orient'; text.textContent = 'Add it to your home screen or desktop. It opens like an app and works offline.'; }
    else if (ios()) { title.textContent = 'Install Orient'; text.textContent = 'In Safari, tap Share, then Add to Home Screen. ' + offlineText(); }
    else { title.textContent = 'Works offline'; text.textContent = offlineText(); }
  }
  async function install() {
    if (!deferred) return;
    deferred.prompt(); try { await deferred.userChoice; } catch { /* dismissed */ }
    deferred = null; render();
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; render(); });
  window.addEventListener('appinstalled', () => { deferred = null; render(); });
  document.addEventListener('click', e => { if (e.target.closest('[data-pwa=install]')) install(); if (e.target.closest('[data-action="settings"]')) render(); });
  if (window.matchMedia) { const q = matchMedia('(display-mode: standalone)'); q.addEventListener && q.addEventListener('change', render); }
  register(); render();
  return { render, install, standalone, state: () => ({ installable: !!deferred, ready: ready(), standalone: standalone() }) };
})();
