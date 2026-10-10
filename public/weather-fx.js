'use strict';
/* The map's weather: gentle rain, snow, fog, drifting cloud shade and the odd flash of lightning, drawn on a canvas that sits
   above the map and never takes a click. It is decoration only: it stops entirely under reduced motion, while the tab is hidden,
   and whenever Weather on the map is switched off. Lightning is a soft, slow glow at most once every several seconds, never a strobe. */
window.OrientWeatherFX = (() => {
  let canvas = null, ctx = null, raf = 0, last = 0, W = 0, H = 0, scale = 1;
  let cfg = { kind: 'none', level: 1, wind: 0, dir: 270 }, parts = [], blobs = [], flash = { t: 0, next: 0, pulses: [] };
  const reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {} };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function ensure() {
    if (canvas) return true;
    const world = document.querySelector('.world'); if (!world) return false;
    canvas = document.createElement('canvas'); canvas.id = 'weather-fx'; canvas.setAttribute('aria-hidden', 'true'); canvas.dataset.fx = 'none'; canvas.dataset.running = 'false';
    const fog = document.getElementById('fog'); fog ? fog.after(canvas) : world.prepend(canvas);
    ctx = canvas.getContext('2d'); new ResizeObserver(resize).observe(world); resize();
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
    reduce.addEventListener && reduce.addEventListener('change', () => { reduce.matches ? stop(true) : start(); });
    return true;
  }
  function resize() {
    if (!canvas) return; const r = canvas.getBoundingClientRect(); scale = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height)); canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
    seed();
  }
  const area = () => Math.max(0.3, (W * H) / (1000 * 800));
  // wind blows from `dir` degrees; screen x grows to the east
  const slant = () => -Math.sin(cfg.dir * Math.PI / 180) * Math.min(cfg.wind / 45, 1);
  function seed() {
    parts = []; blobs = [];
    const k = cfg.kind, lv = Math.max(1, cfg.level || 1);
    if (k === 'rain' || k === 'storm') {
      const n = Math.round(area() * (k === 'storm' ? 200 : 90) * (lv === 1 ? 1 : lv === 2 ? 2 : 3.2));
      for (let i = 0; i < n; i++) parts.push({ x: rnd(-60, W + 60), y: rnd(0, H), len: rnd(7, 15) * (lv === 1 ? 0.7 : 1), v: rnd(520, 820) * (lv === 1 ? 0.75 : 1), a: rnd(0.35, 0.7) });
    } else if (k === 'snow') {
      const n = Math.round(area() * 85 * (lv === 1 ? 1 : lv === 2 ? 2 : 3));
      for (let i = 0; i < n; i++) parts.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1.8, 4.2), v: rnd(22, 55), ph: rnd(0, 6.28), sw: rnd(8, 26), a: rnd(0.55, 0.95) });
    } else if (k === 'fog') {
      for (let i = 0; i < 5; i++) blobs.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.35, 0.6) * Math.max(W, H), v: rnd(4, 11) * (Math.random() < .5 ? -1 : 1), a: 0.2 + 0.05 * lv });
    } else if (k === 'clouds') {
      const n = lv >= 2 ? 6 : 3;
      for (let i = 0; i < n; i++) blobs.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.22, 0.4) * Math.max(W, H), v: rnd(6, 14), a: lv >= 2 ? 0.12 : 0.085, shade: true });
    }
  }
  function draw(dt) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.clearRect(0, 0, W, H);
    const k = cfg.kind;
    if (k === 'rain' || k === 'storm') {
      const sl = slant() * 0.5 + 0.12; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      for (const p of parts) {
        p.y += p.v * dt; p.x += p.v * sl * dt; if (p.y > H + 20) { p.y = -20; p.x = rnd(-60, W + 60); } if (p.x > W + 60) p.x = -60; if (p.x < -60) p.x = W + 60;
        ctx.strokeStyle = 'rgba(54,96,128,' + p.a + ')'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.len * sl, p.y - p.len); ctx.stroke();
      }
      ctx.fillStyle = k === 'storm' ? 'rgba(38,56,78,0.16)' : 'rgba(62,88,110,0.08)'; ctx.fillRect(0, 0, W, H);
      if (k === 'storm') lightning(dt);
    } else if (k === 'snow') {
      const sl = slant() * 22;
      for (const p of parts) {
        p.y += p.v * dt; p.ph += dt * 1.2; p.x += (Math.sin(p.ph) * p.sw + sl) * dt; if (p.y > H + 6) { p.y = -6; p.x = rnd(0, W); } if (p.x > W + 6) p.x = -6; if (p.x < -6) p.x = W + 6;
        ctx.fillStyle = 'rgba(255,255,255,' + p.a + ')'; ctx.strokeStyle = 'rgba(105,140,170,0.5)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(214,228,240,0.12)'; ctx.fillRect(0, 0, W, H);
    } else if (k === 'fog' || k === 'clouds') {
      if (k === 'fog') { ctx.fillStyle = 'rgba(232,238,236,' + (0.12 + 0.05 * cfg.level) + ')'; ctx.fillRect(0, 0, W, H); }
      for (const b of blobs) {
        b.x += b.v * dt; if (b.x > W + b.r) b.x = -b.r; if (b.x < -b.r) b.x = W + b.r;
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r), c = b.shade ? '48,66,74' : '236,242,240';
        g.addColorStop(0, 'rgba(' + c + ',' + b.a + ')'); g.addColorStop(1, 'rgba(' + c + ',0)'); ctx.fillStyle = g; ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      }
    }
  }
  // a slow glow, at most one burst every 8-18 seconds, two soft pulses well under three a second
  function lightning(dt) {
    flash.t += dt;
    if (flash.t >= flash.next) { flash.next = flash.t + rnd(8, 18); flash.pulses = [{ at: flash.t, peak: 0.22 }, { at: flash.t + 0.45, peak: 0.12 }]; }
    let a = 0; for (const p of flash.pulses) { const x = flash.t - p.at; if (x >= 0 && x < 0.7) a = Math.max(a, p.peak * Math.sin(Math.PI * x / 0.7)); }
    if (a > 0.004) { ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function frame(ts) {
    if (!canvas || cfg.kind === 'none' || document.hidden || reduce.matches) { stop(); return; }
    const dt = Math.min((ts - (last || ts)) / 1000, 0.05); last = ts; draw(dt); raf = requestAnimationFrame(frame);
  }
  function start() {
    if (!canvas || raf || cfg.kind === 'none' || document.hidden || reduce.matches) return;
    last = 0; canvas.dataset.running = 'true'; raf = requestAnimationFrame(frame);
  }
  function stop(clear = true) {
    if (raf) cancelAnimationFrame(raf); raf = 0; if (canvas) { canvas.dataset.running = 'false'; if (clear && ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); } }
  }
  function set(next) {
    if (!ensure()) return;
    const prev = cfg.kind; cfg = { ...cfg, ...next, level: next.level || cfg.level || 1 };
    canvas.dataset.fx = cfg.kind; canvas.dataset.level = String(cfg.level);
    if (cfg.kind === 'none') { stop(); return; }
    seed(); flash = { t: 0, next: rnd(2, 5), pulses: [] };
    if (!raf) start(); else if (prev === 'none') start();
  }
  return { set, state: () => ({ ...cfg, running: !!raf }), reducedMotion: () => reduce.matches };
})();
