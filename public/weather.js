'use strict';
/* Weather: the temperature beside the title, a report behind it, and how this day looked in other years.
   Forecast and history come from Open-Meteo (no account, no key, CC BY 4.0); US alerts come from the National Weather Service.
   Privacy: the only thing sent is the area's position rounded to about 10 km (0.1 degree), and only while Weather is switched on
   in the field kit. Nothing about your saved places, visits or notes is ever included. Switch it off and no request is made. */
window.OrientWeather = (() => {
  const PREF = 'orient-weather-v1', CACHE = 'orient-weather-cache-v1', FRESH = 20 * 60e3, STALE = 3 * 3600e3;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jget = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage can be blocked; the weather just is not remembered */ } };
  const prefs = () => ({ show: true, fx: true, units: 'auto', ...jget(PREF, {}) });
  const setPrefs = p => jset(PREF, p);

  // [label, day icon, night icon, effect on the map, strength 1-3]
  const WMO = {
    0: ['Clear', 'sun', 'moon', 'none', 0], 1: ['Mostly clear', 'sun', 'moon', 'none', 0], 2: ['Partly cloudy', 'cloud-sun', 'cloud-moon', 'clouds', 1], 3: ['Overcast', 'cloud', 'cloud', 'clouds', 2],
    45: ['Fog', 'cloud-fog', 'cloud-fog', 'fog', 1], 48: ['Freezing fog', 'cloud-fog', 'cloud-fog', 'fog', 2],
    51: ['Light drizzle', 'cloud-drizzle', 'cloud-drizzle', 'rain', 1], 53: ['Drizzle', 'cloud-drizzle', 'cloud-drizzle', 'rain', 1], 55: ['Heavy drizzle', 'cloud-drizzle', 'cloud-drizzle', 'rain', 2],
    56: ['Freezing drizzle', 'cloud-drizzle', 'cloud-drizzle', 'rain', 1], 57: ['Freezing drizzle', 'cloud-drizzle', 'cloud-drizzle', 'rain', 2],
    61: ['Light rain', 'cloud-rain', 'cloud-rain', 'rain', 1], 63: ['Rain', 'cloud-rain', 'cloud-rain', 'rain', 2], 65: ['Heavy rain', 'cloud-rain', 'cloud-rain', 'rain', 3],
    66: ['Freezing rain', 'cloud-rain', 'cloud-rain', 'rain', 2], 67: ['Freezing rain', 'cloud-rain', 'cloud-rain', 'rain', 3],
    71: ['Light snow', 'cloud-snow', 'cloud-snow', 'snow', 1], 73: ['Snow', 'cloud-snow', 'cloud-snow', 'snow', 2], 75: ['Heavy snow', 'cloud-snow', 'cloud-snow', 'snow', 3], 77: ['Snow grains', 'cloud-snow', 'cloud-snow', 'snow', 1],
    80: ['Light showers', 'cloud-rain', 'cloud-rain', 'rain', 1], 81: ['Showers', 'cloud-rain', 'cloud-rain', 'rain', 2], 82: ['Heavy showers', 'cloud-rain', 'cloud-rain', 'rain', 3],
    85: ['Snow showers', 'cloud-snow', 'cloud-snow', 'snow', 2], 86: ['Heavy snow showers', 'cloud-snow', 'cloud-snow', 'snow', 3],
    95: ['Thunderstorm', 'cloud-lightning', 'cloud-lightning', 'storm', 2], 96: ['Thunderstorm, hail', 'cloud-hail', 'cloud-hail', 'storm', 3], 99: ['Thunderstorm, hail', 'cloud-hail', 'cloud-hail', 'storm', 3],
  };
  const cond = c => WMO[c] || ['Unsettled', 'cloud', 'cloud', 'clouds', 1];
  const iconOf = (code, day = 1) => cond(code)[day ? 1 : 2];
  const toneOf = (code, day = 1) => { const k = cond(code)[3]; return k === 'none' ? (day ? 'sun' : 'night') : k === 'clouds' ? (day ? 'cloud' : 'night') : k; };

  let api = null, fc = null, alerts = [], dialog = null, loading = null, lastErr = false, previewKind = null, timer = null;
  const r1 = v => Math.round(v * 10) / 10;
  const here = () => { const o = api && api.origin && api.origin(); return o && o.length === 2 && o.every(Number.isFinite) ? { lat: r1(o[1]), lng: r1(o[0]) } : null; };
  const inUS = p => p.lat > 17 && p.lat < 72 && p.lng < -64 && p.lng > -180;
  const units = () => { const u = prefs().units; if (u === 'us' || u === 'si') return u; const p = here(); return p && inUS(p) ? 'us' : 'si'; };

  // ----- formatting (the data is stored in metric and shown in either) -----
  const tempN = c => units() === 'us' ? c * 9 / 5 + 32 : c;
  const temp = c => Math.round(tempN(c)) + '°';
  const speed = k => units() === 'us' ? Math.round(k * 0.621371) + ' mph' : Math.round(k) + ' km/h';
  const rain = mm => units() === 'us' ? (mm < 0.127 ? 'none' : (mm / 25.4).toFixed(2) + ' in') : (mm < 0.1 ? 'none' : mm.toFixed(1) + ' mm');
  const hour = s => { const h = +s.slice(11, 13); return (h % 12 || 12) + (h < 12 ? ' am' : ' pm'); };
  const clock = s => { const h = +s.slice(11, 13), m = s.slice(14, 16); return (h % 12 || 12) + ':' + m + (h < 12 ? ' am' : ' pm'); };
  const ymd = s => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const dayName = (s, i) => i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : ymd(s).toLocaleDateString(undefined, { weekday: 'long' });
  const longDate = s => ymd(s).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const compass = d => ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(((d % 360) + 360) % 360 / 45) % 8];
  const icon = (name, cls = '') => '<i data-lucide="' + name + '" class="' + cls + '" aria-hidden="true"></i>';
  const paint = () => { try { window.lucide && window.lucide.createIcons(); } catch { /* icons are decoration */ } };

  async function getJSON(url, ms = 9000) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); }
  }

  // ----- current weather, forecast and alerts -----
  const nowIndex = () => { const k = fc.current.time.slice(0, 13) + ':00', i = fc.hourly.time.indexOf(k); return i < 0 ? 0 : i; };
  function setChip() {
    const bar = document.querySelector('.masthead'); let chip = document.querySelector('.weather-chip');
    if (!prefs().show || !fc) { chip && chip.remove(); return; }
    if (!chip) { chip = document.createElement('button'); chip.type = 'button'; chip.className = 'weather-chip'; chip.dataset.weather = 'open'; const edition = bar && bar.querySelector('.edition'); edition ? edition.after(chip) : bar && bar.append(chip); }
    const c = fc.current, name = cond(c.weather_code)[0], top = alerts[0];
    chip.innerHTML = icon(iconOf(c.weather_code, c.is_day), 'wx-ico') + '<b>' + temp(c.temperature_2m) + '</b>' + (top ? '<span class="wx-dot" aria-hidden="true"></span>' : '');
    chip.setAttribute('aria-label', 'Weather: ' + temp(c.temperature_2m) + ', ' + name.toLowerCase() + (top ? '. ' + top.event + ' in effect' : '') + '. Open the weather report.');
    chip.dataset.alert = top ? '1' : '0'; chip.dataset.tone = toneOf(c.weather_code, c.is_day);
    paint();
  }
  function applyFx() {
    if (!window.OrientWeatherFX) return;
    if (!prefs().fx || !prefs().show || !fc) { OrientWeatherFX.set({ kind: 'none' }); return; }
    const c = fc.current, k = cond(c.weather_code);
    OrientWeatherFX.set({ kind: previewKind || k[3], level: previewKind ? 2 : k[4], wind: c.wind_speed_10m, dir: c.wind_direction_10m });
  }
  const outlook = () => {
    if (!fc) return '';
    const h = fc.hourly, i = nowIndex(), ck = cond(fc.current.weather_code)[3];
    if (ck === 'rain' || ck === 'snow' || ck === 'storm') return (ck === 'snow' ? 'Snow' : ck === 'storm' ? 'Storms' : 'Rain') + ' right now';
    for (let k = 0; k < 12; k++) {
      if ((h.precipitation_probability[i + k] || 0) >= 50) { const kind = cond(h.weather_code[i + k])[3], what = kind === 'snow' ? 'Snow' : kind === 'storm' ? 'Storms' : 'Rain'; return k === 0 ? what + ' likely now' : what + ' likely around ' + hour(h.time[i + k]); }
    }
    return 'Dry for the next 12 hours';
  };
  function dressToday() {
    const panel = document.getElementById('panel'); if (!panel) return;
    const heading = panel.querySelector('.today-heading');
    const old = panel.querySelector('.weather-strip');
    if (!prefs().show || !fc) { old && old.remove(); return; }
    if (!heading) return;
    const c = fc.current, d = fc.daily, top = alerts[0];
    const html = icon(iconOf(c.weather_code, c.is_day), 'wx-ico') + '<span class="wx-copy"><b>' + temp(c.temperature_2m) + ' · ' + esc(cond(c.weather_code)[0]) + '</b><small>High ' + temp(d.temperature_2m_max[0]) + ' · Low ' + temp(d.temperature_2m_min[0]) + ' · ' + esc(outlook()) + '</small></span>' + (top ? '<span class="tag wx-alert-tag">' + esc(top.event) + '</span>' : '') + '<span aria-hidden="true" class="wx-go">›</span>';
    if (old) { if (old.dataset.html !== html) { old.innerHTML = html; old.dataset.html = html; paint(); } return; }
    const strip = document.createElement('button'); strip.type = 'button'; strip.className = 'weather-strip'; strip.dataset.weather = 'open'; strip.dataset.html = html; strip.innerHTML = html; strip.dataset.tone = toneOf(c.weather_code, c.is_day);
    strip.setAttribute('aria-label', 'Weather: ' + temp(c.temperature_2m) + ', ' + cond(c.weather_code)[0].toLowerCase() + '. Open the weather report.');
    heading.after(strip); paint();
  }
  // A small, unit-free reading of the weather for recommendations: how it feels to be outside right now.
  function snapshot() {
    if (!fc || !prefs().show) return null;
    const c = fc.current, k = cond(c.weather_code), h = fc.hourly, i = nowIndex();
    let soon = 0; for (let j = 1; j <= 3; j++) soon = Math.max(soon, h.precipitation_probability[i + j] || 0);
    const sev = alerts.find(a => a.severity === 'Severe' || a.severity === 'Extreme');
    return { kind: k[3], level: k[4], label: k[0], temp: c.temperature_2m, feels: c.apparent_temperature, wind: c.wind_speed_10m, day: !!c.is_day, rainSoon: soon >= 50 && !['rain', 'snow', 'storm'].includes(k[3]), severe: sev ? sev.event : '' };
  }
  // mood: rough (better indoors), iffy (keep it short and close), lovely (a good time to be outside), fine (no opinion).
  function judge() {
    const s = snapshot(); if (!s) return null;
    const out = (mood, text, hard = false) => ({ mood, text, hard, label: s.label, temp: s.temp });
    if (s.severe) return out('rough', s.severe + ' is in effect: best to stay inside.', true);
    if (s.kind === 'storm') return out('rough', 'Thunderstorms around: somewhere indoors is the better call.');
    if (s.kind === 'rain') return s.level >= 2 ? out('rough', 'It’s raining: somewhere indoors keeps you dry.') : out('iffy', 'Light rain: fine with a jacket, and better close by.');
    if (s.kind === 'snow') return s.level >= 2 ? out('rough', 'It’s snowing: dress warm, or choose somewhere indoors.') : out('iffy', 'A little snow is falling: dress warm and keep it close.');
    if (s.feels <= -8) return out('rough', 'It feels like ' + temp(s.feels) + ': dress warm, or choose somewhere indoors.');
    if (s.feels >= 33) return out('rough', 'It feels like ' + temp(s.feels) + ': somewhere with shade or air conditioning is kinder.');
    if (s.wind >= 45) return out('rough', 'It’s very windy out: somewhere indoors is easier today.');
    if (s.kind === 'fog') return out('iffy', 'It’s foggy: take it slow and keep it close.');
    if (s.rainSoon) return out('iffy', 'Rain is likely within a few hours: keep it short or close.');
    if (s.day && (s.kind === 'none' || (s.kind === 'clouds' && s.level <= 1)) && s.feels >= 10 && s.feels <= 27) return out('lovely', 'It’s ' + temp(s.temp) + ' and ' + s.label.toLowerCase() + ': a nice time to be outside.');
    return out('fine', '');
  }
  // A short summary for the Civic tab.
  function brief() {
    if (!fc || !prefs().show) return null;
    const c = fc.current, d = fc.daily;
    return { temp: temp(c.temperature_2m), label: cond(c.weather_code)[0], icon: iconOf(c.weather_code, c.is_day), detail: 'High ' + temp(d.temperature_2m_max[0]) + ' · Low ' + temp(d.temperature_2m_min[0]) + ' · ' + outlook(), alerts: alerts.map(a => ({ event: a.event, severity: a.severity || '', headline: a.headline || '', area: a.areaDesc || '' })) };
  }
  let lastMood = null, soon = 0;
  // The app may still be starting up when a cached forecast arrives, so drawing again waits a moment and skips an open dialog.
  // It also never redraws under a finger: a drag on the briefing drawer, say, must not be interrupted.
  let pressed = false; document.addEventListener('pointerdown', () => { pressed = true; }, true); ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => { pressed = false; }, true));
  function drawSoon() { clearTimeout(soon); soon = setTimeout(() => { if (pressed || document.querySelector('dialog[open]')) return drawSoon(); try { api.render(); } catch { /* the next change draws it */ } }, 250); }
  function everywhere() {
    setChip(); applyFx(); dressToday(); if (dialog && dialog.open) renderReport();
    document.dispatchEvent(new Event('orient-weather'));
    // Today and "Get me out" lean on the weather; when it first arrives or its mood changes, draw them again.
    const j = judge(), sig = j ? j.mood + '|' + j.text : '';
    if (sig !== lastMood) { const first = lastMood === null; lastMood = sig; if ((!first || sig) && api.render) drawSoon(); }
  }

  async function refresh(force = false) {
    if (!api) return;
    if (!prefs().show) { fc = null; alerts = []; setChip(); applyFx(); dressToday(); return; }
    const p = here(); if (!p) return;
    const key = p.lat + ',' + p.lng, cache = jget(CACHE, null);
    if (!force && cache && cache.key === key && Date.now() - cache.at < FRESH) { fc = cache.fc; alerts = cache.alerts || []; lastErr = false; everywhere(); return; }
    if (loading) return loading;
    loading = (async () => {
      try {
        const [f, a] = await Promise.allSettled([
          getJSON('https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lng + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max&timezone=auto&forecast_days=7'),
          inUS(p) ? getJSON('https://api.weather.gov/alerts/active?point=' + p.lat.toFixed(2) + ',' + p.lng.toFixed(2)) : Promise.resolve(null),
        ]);
        if (f.status === 'fulfilled' && f.value && f.value.current && f.value.daily && f.value.hourly) {
          fc = f.value; lastErr = false;
          const order = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3 };
          alerts = a.status === 'fulfilled' && a.value && Array.isArray(a.value.features) ? a.value.features.map(x => x.properties).filter(x => x && x.event).sort((x, y) => (order[x.severity] ?? 4) - (order[y.severity] ?? 4)) : [];
          jset(CACHE, { key, at: Date.now(), fc, alerts: alerts.map(x => ({ event: x.event, severity: x.severity, headline: x.headline, description: String(x.description || '').slice(0, 1500), instruction: String(x.instruction || '').slice(0, 800), expires: x.expires || x.ends || '', areaDesc: x.areaDesc || '' })) });
        } else {
          lastErr = true;
          if (cache && cache.key === key && Date.now() - cache.at < STALE) { fc = cache.fc; alerts = cache.alerts || []; } else { fc = null; alerts = []; }
        }
      } catch { lastErr = true; } finally { loading = null; everywhere(); }
    })();
    return loading;
  }

  // ----- the report -----
  const SEV = { Extreme: 'extreme', Severe: 'severe', Moderate: 'moderate', Minor: 'minor' };
  function alertsHTML() {
    if (!alerts.length) return '';
    return '<section class="wx-section" aria-label="Weather alerts">' + alerts.slice(0, 4).map(a => '<details class="wx-alert" data-sev="' + (SEV[a.severity] || 'minor') + '"><summary>' + icon('triangle-alert') + '<span><b>' + esc(a.event) + '</b><small>' + esc(a.headline || a.areaDesc || '') + '</small></span></summary><div>' +
      (a.expires ? '<p class="fine">Until ' + esc(new Date(a.expires).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })) + '</p>' : '') + '<p>' + esc(a.description || '').replace(/\n+/g, '<br>') + '</p>' + (a.instruction ? '<p><b>What to do.</b> ' + esc(a.instruction) + '</p>' : '') + '<p class="fine">From the National Weather Service. For anything urgent, follow your local emergency guidance.</p></div></details>').join('') + '</section>';
  }
  function hourlyHTML() {
    const h = fc.hourly, i = nowIndex(), items = [];
    for (let k = 0; k < 24; k += 2) { const j = i + k; if (j >= h.time.length) break; items.push('<li><span>' + (k === 0 ? 'Now' : hour(h.time[j])) + '</span>' + icon(iconOf(h.weather_code[j], h.is_day[j]), 'wx-ico') + '<b>' + temp(h.temperature_2m[j]) + '</b><small>' + (h.precipitation_probability[j] >= 20 ? h.precipitation_probability[j] + '%' : '&nbsp;') + '</small></li>'); }
    return '<ul class="wx-hours">' + items.join('') + '</ul>';
  }
  function weekHTML() {
    const d = fc.daily, lo = Math.min(...d.temperature_2m_min), hi = Math.max(...d.temperature_2m_max), span = Math.max(hi - lo, 1);
    return '<ul class="wx-week">' + d.time.map((t, i) => { const a = (d.temperature_2m_min[i] - lo) / span * 100, b = (d.temperature_2m_max[i] - lo) / span * 100; return '<li><span class="wx-day">' + esc(dayName(t, i)) + '</span>' + icon(iconOf(d.weather_code[i], 1), 'wx-ico') + '<small class="wx-pop">' + (d.precipitation_probability_max[i] >= 20 ? d.precipitation_probability_max[i] + '%' : '') + '</small><span class="wx-lo">' + temp(d.temperature_2m_min[i]) + '</span><span class="wx-bar" aria-hidden="true"><i style="left:' + a.toFixed(1) + '%;width:' + Math.max(b - a, 6).toFixed(1) + '%"></i></span><span class="wx-hi">' + temp(d.temperature_2m_max[i]) + '</span></li>'; }).join('') + '</ul>';
  }
  function factsHTML() {
    const c = fc.current, d = fc.daily;
    const f = (ic, label, v) => '<div class="wx-fact">' + icon(ic) + '<span>' + label + '</span><b>' + v + '</b></div>';
    return '<div class="wx-facts">' + f('wind', 'Wind', speed(c.wind_speed_10m) + ' from the ' + compass(c.wind_direction_10m)) + f('droplets', 'Humidity', Math.round(c.relative_humidity_2m) + '%') + f('sun-medium', 'UV today', Math.round(d.uv_index_max[0])) +
      f('umbrella', 'Rain today', (d.precipitation_probability_max[0] || 0) + '% · ' + rain(d.precipitation_sum[0])) + f('sunrise', 'Sunrise', clock(d.sunrise[0])) + f('sunset', 'Sunset', clock(d.sunset[0])) + '</div>';
  }
  function renderReport() {
    if (!dialog) return;
    const body = dialog.querySelector('[data-wx-body]'); if (!body) return;
    if (!fc) { body.innerHTML = '<p class="sub">' + (lastErr ? 'The weather couldn’t be reached just now. Your map is unaffected.' : 'Looking up the weather…') + '</p><button type="button" class="button" data-weather="refresh">Try again</button>'; return; }
    const c = fc.current, d = fc.daily, label = api.label ? api.label() : '';
    dialog.querySelector('[data-wx-place]').textContent = label ? label : 'Your area';
    body.innerHTML = '<section class="wx-hero" data-tone="' + toneOf(c.weather_code, c.is_day) + '">' + icon(iconOf(c.weather_code, c.is_day), 'wx-big') + '<div><b class="wx-temp">' + temp(c.temperature_2m) + '</b><span>' + esc(cond(c.weather_code)[0]) + '</span><small>Feels like ' + temp(c.apparent_temperature) + ' · High ' + temp(d.temperature_2m_max[0]) + ' · Low ' + temp(d.temperature_2m_min[0]) + '</small></div></section>' +
      alertsHTML() +
      '<section class="wx-section"><h3 class="ui-kicker">Next 24 hours</h3>' + hourlyHTML() + '</section>' +
      '<section class="wx-section"><h3 class="ui-kicker">This week</h3>' + weekHTML() + '</section>' +
      '<section class="wx-section"><h3 class="ui-kicker">Right now</h3>' + factsHTML() + '</section>' +
      '<section class="wx-section" data-wx-history><h3 class="ui-kicker">This day, in other years</h3><p class="fine wx-wait">Looking back…</p></section>' +
      '<section class="wx-section" data-wx-climate><h3 class="ui-kicker">What is usual for this time of year</h3><p class="fine wx-wait">Gathering thirty years of ' + esc(ymd(c.time).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })) + 's…</p></section>' +
      '<details class="ui-more wx-preview"><summary>' + icon('wand-sparkles') + 'Preview the map’s weather</summary><div><p class="fine">Try the map in different weather. This is only a preview and ends when you close the report.</p><div class="ui-chips" role="group" aria-label="Preview map weather">' +
      [['', 'Today’s weather'], ['rain', 'Rain'], ['snow', 'Snow'], ['storm', 'Thunderstorm'], ['fog', 'Fog'], ['clouds', 'Clouds']].map(([k, n]) => '<button type="button" class="ui-chip" data-weather="preview" data-kind="' + k + '" aria-pressed="' + ((previewKind || '') === k) + '">' + n + '</button>').join('') + '</div></div></details>' +
      '<div class="wx-foot"><button type="button" class="button" data-weather="units">Show ' + (units() === 'us' ? '°C and km/h' : '°F and mph') + '</button><button type="button" class="button" data-weather="refresh">Refresh</button></div>' +
      '<p class="fine">Forecast and past weather: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (CC BY 4.0), past days from the ERA5 reanalysis, a model of the surrounding grid cell rather than one weather station. Alerts: the US National Weather Service. Orient sends only this area’s position, rounded to about 10 km.</p>';
    paint(); loadHistory();
  }

  // ----- this day in other years, and what is usual -----
  const YEARS_BACK = [1, 2, 5, 10, 20, 30, 50, 75];
  const archive = (p, a, b, vars) => getJSON('https://archive-api.open-meteo.com/v1/archive?latitude=' + p.lat + '&longitude=' + p.lng + '&start_date=' + a + '&end_date=' + b + '&daily=' + vars + '&timezone=auto', 20000);
  const pad = n => String(n).padStart(2, '0');
  const sameDay = (year, m, d) => { const dt = new Date(year, m - 1, d); if (dt.getMonth() !== m - 1) dt.setDate(0); return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); };
  const doy = (m, d) => Math.round((Date.UTC(2001, m - 1, d === 29 && m === 2 ? 28 : d) - Date.UTC(2001, 0, 1)) / 864e5);

  function summarize(daily, m, d, todayHigh) {
    const target = doy(m, d), win = { hi: [], lo: [] }, exact = [];
    daily.time.forEach((t, i) => {
      const mm = +t.slice(5, 7), dd = +t.slice(8, 10), hi = daily.temperature_2m_max[i], lo = daily.temperature_2m_min[i], pr = daily.precipitation_sum[i];
      let dist = Math.abs(doy(mm, dd) - target); dist = Math.min(dist, 365 - dist);
      if (dist <= 3 && Number.isFinite(hi) && Number.isFinite(lo)) { win.hi.push(hi); win.lo.push(lo); }
      if (mm === m && dd === d && Number.isFinite(hi)) exact.push({ year: +t.slice(0, 4), hi, lo, pr: Number.isFinite(pr) ? pr : 0 });
    });
    if (!win.hi.length) return null;
    const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
    const best = (list, f, dir) => list.reduce((b, x) => (b === null || (dir > 0 ? f(x) > f(b) : f(x) < f(b))) ? x : b, null);
    return {
      avgHi: avg(win.hi), avgLo: avg(win.lo), n: exact.length, exact,
      warmest: best(exact, x => x.hi, 1), coldest: best(exact, x => x.lo, -1), wettest: best(exact, x => x.pr, 1),
      pct: Number.isFinite(todayHigh) ? Math.round(win.hi.filter(v => v <= todayHigh).length / win.hi.length * 100) : null,
    };
  }
  function chart(s, todayHigh) {
    const vals = s.exact.map(x => x.hi).concat(Number.isFinite(todayHigh) ? [todayHigh] : []), lo = Math.min(...vals) - 2, hi = Math.max(...vals) + 2, W = 300, H = 92, bw = W / s.exact.length;
    const y = v => H - (v - lo) / (hi - lo) * (H - 6) - 2;
    const bars = s.exact.map((x, i) => '<rect x="' + (i * bw + 1).toFixed(1) + '" y="' + y(x.hi).toFixed(1) + '" width="' + (bw - 2).toFixed(1) + '" height="' + (H - y(x.hi)).toFixed(1) + '" rx="2" class="' + (Number.isFinite(todayHigh) && x.hi > todayHigh ? 'warm' : 'cool') + '"><title>' + x.year + ': ' + temp(x.hi) + '</title></rect>').join('');
    const line = Number.isFinite(todayHigh) ? '<line x1="0" x2="' + W + '" y1="' + y(todayHigh).toFixed(1) + '" y2="' + y(todayHigh).toFixed(1) + '" class="today"/>' : '';
    return '<svg class="wx-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="High temperature on this date in each year from ' + s.exact[0].year + ' to ' + s.exact[s.exact.length - 1].year + ', compared with today’s forecast high of ' + temp(todayHigh) + '">' + bars + line + '</svg><p class="fine wx-chart-note"><span class="cool-key"></span>cooler than today <span class="warm-key"></span>warmer than today · each bar is one year, ' + s.exact[0].year + ' to ' + s.exact[s.exact.length - 1].year + '</p>';
  }
  async function loadHistory() {
    const p = here(); if (!p || !fc) return;
    const today = fc.current.time.slice(0, 10), [Y, M, D] = today.split('-').map(Number), todayHigh = fc.daily.temperature_2m_max[0], stamp = today + '|' + p.lat + ',' + p.lng;
    const hist = dialog.querySelector('[data-wx-history]'), clim = dialog.querySelector('[data-wx-climate]');
    const live = () => dialog && dialog.open && dialog.dataset.stamp === stamp;
    dialog.dataset.stamp = stamp;
    const years = YEARS_BACK.filter(n => Y - n >= 1940);
    Promise.allSettled(years.map(n => { const dte = sameDay(Y - n, M, D); return archive(p, dte, dte, 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum').then(r => ({ n, date: dte, r })); })).then(res => {
      if (!live()) return;
      const rows = res.filter(x => x.status === 'fulfilled' && x.value.r && x.value.r.daily && Number.isFinite(x.value.r.daily.temperature_2m_max[0])).map(x => x.value);
      if (!rows.length) { hist.querySelector('.wx-wait').textContent = 'Past weather isn’t available right now.'; return; }
      hist.innerHTML = '<h3 class="ui-kicker">This day, in other years</h3><ul class="wx-years">' + rows.map(({ n, date, r }) => {
        const dd = r.daily, hi = dd.temperature_2m_max[0], lo = dd.temperature_2m_min[0], code = dd.weather_code[0], snow = dd.snowfall_sum[0] || 0, pr = dd.precipitation_sum[0] || 0;
        const diff = Math.round(tempN(hi) - tempN(todayHigh)), cmp = diff === 0 ? 'about the same as today' : Math.abs(diff) + '° ' + (diff > 0 ? 'warmer' : 'cooler') + ' than today';
        return '<li><span class="wx-yr"><b>' + (n === 1 ? 'Last year' : n + ' years ago') + '</b><small>' + esc(longDate(date)) + '</small></span>' + icon(iconOf(code, 1), 'wx-ico') + '<span class="wx-yr-t"><b>' + temp(hi) + ' <i>/ ' + temp(lo) + '</i></b><small>' + esc(cond(code)[0]) + (snow > 0.1 ? ' · ' + (units() === 'us' ? (snow / 2.54).toFixed(1) + ' in snow' : snow.toFixed(1) + ' cm snow') : pr >= 0.2 ? ' · ' + rain(pr) : '') + ' · ' + cmp + '</small></span></li>';
      }).join('') + '</ul>'; paint();
    });
    const ck = 'orient-weather-climate-' + p.lat + ',' + p.lng, saved = jget(ck, null);
    const draw = s => { if (!live()) return; if (!s || !s.n) { clim.querySelector('.wx-wait').textContent = 'Climate history isn’t available right now.'; return; }
      const rec = (label, x, v) => x ? '<div class="wx-fact"><span>' + label + '</span><b>' + v + '</b><small>' + x.year + '</small></div>' : '';
      clim.innerHTML = '<h3 class="ui-kicker">What is usual for this time of year</h3><p class="wx-usual">Around ' + esc(ymd(today).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })) + ', highs are usually near <b>' + temp(s.avgHi) + '</b> and lows near <b>' + temp(s.avgLo) + '</b> <span class="fine">(1991–2020 average for the week around this date).</span></p>' +
        (s.pct === null ? '' : '<p class="wx-usual">Today’s forecast high of ' + temp(todayHigh) + ' is ' + (s.pct >= 98 ? 'warmer than nearly every high' : s.pct <= 2 ? 'cooler than nearly every high' : 'warmer than ' + s.pct + '% of highs') + ' around this date.</p>') + chart(s, todayHigh) +
        '<div class="wx-facts">' + rec('Warmest ' + ymd(today).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), s.warmest, temp(s.warmest && s.warmest.hi)) + rec('Coldest night', s.coldest, temp(s.coldest && s.coldest.lo)) + rec('Wettest', s.wettest && s.wettest.pr > 0 ? s.wettest : null, s.wettest ? rain(s.wettest.pr) : '') + '</div>'; paint(); };
    if (saved && saved.md === pad(M) + '-' + pad(D) && saved.v === 1) return draw(saved.s);
    archive(p, '1991-01-01', '2020-12-31', 'temperature_2m_max,temperature_2m_min,precipitation_sum').then(r => {
      const s = summarize(r.daily, M, D, todayHigh); if (s) jset(ck, { md: pad(M) + '-' + pad(D), v: 1, s: { ...s, exact: s.exact } }); draw(s);
    }).catch(() => { if (live()) clim.querySelector('.wx-wait').textContent = 'Climate history isn’t available right now.'; });
  }

  // ----- opening, closing and the controls -----
  function open() {
    if (!prefs().show) return;
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = 'weather-dialog'; dialog.setAttribute('aria-labelledby', 'weather-title');
      dialog.innerHTML = '<div class="panel-heading"><div><span class="ui-kicker">Weather</span><h2 id="weather-title" data-wx-place>Your area</h2></div><button type="button" class="icon-button" data-weather="close" aria-label="Close weather"><i data-lucide="x"></i></button></div><div data-wx-body></div>';
      document.body.append(dialog);
      dialog.addEventListener('close', () => { if (previewKind) { previewKind = null; applyFx(); } });
    }
    renderReport(); if (!dialog.open) dialog.showModal(); paint();
    if (!fc || Date.now() - (jget(CACHE, { at: 0 }).at || 0) > FRESH) refresh(!fc);
  }
  function onClick(e) {
    const b = e.target.closest('[data-weather]'); if (!b) return;
    const a = b.dataset.weather;
    if (a === 'open') open();
    else if (a === 'close') dialog && dialog.close();
    else if (a === 'refresh') refresh(true);
    else if (a === 'units') { const p = prefs(); p.units = units() === 'us' ? 'si' : 'us'; setPrefs(p); everywhere(); }
    else if (a === 'preview') { previewKind = b.dataset.kind || null; applyFx(); dialog.querySelectorAll('[data-weather=preview]').forEach(x => x.setAttribute('aria-pressed', String((previewKind || '') === x.dataset.kind))); }
  }
  function bindSettings() {
    const show = document.getElementById('weather-toggle'), fx = document.getElementById('weather-fx-toggle');
    if (!show || show.dataset.bound) return; show.dataset.bound = '1';
    const sync = () => { const p = prefs(); show.checked = p.show; fx.checked = p.fx; fx.disabled = !p.show; };
    show.addEventListener('change', () => { const p = prefs(); p.show = show.checked; setPrefs(p); sync(); refresh(true); });
    fx.addEventListener('change', () => { const p = prefs(); p.fx = fx.checked; setPrefs(p); applyFx(); });
    document.addEventListener('click', e => { if (e.target.closest('[data-action="settings"]')) sync(); });
    sync();
  }

  function init(a) {
    api = a; document.addEventListener('click', onClick); bindSettings();
    new MutationObserver(() => dressToday()).observe(document.getElementById('panel') || document.body, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    clearInterval(timer); timer = setInterval(() => { if (!document.hidden) refresh(); }, FRESH);
    refresh();
  }
  return { init, refresh, open, summarize, cond, snapshot, judge, brief, state: () => ({ fc, alerts, units: units() }) };
})();
