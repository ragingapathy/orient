'use strict';
/* Your places in formats other tools read: GeoJSON, CSV and GPX waypoints. Built here, on this device, from the saved map
   in this browser; nothing is sent anywhere. The neighbor guide is never included. Orient's own export (the JSON file beside
   these buttons) stays the one to use for a full backup or for moving to another device. */
window.OrientOpenExport = (() => {
  const KEY = 'orient-field-map-v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

  // One flat record per saved place: what a spreadsheet or another map app can use.
  function rows(store) {
    const saved = new Set(store.saved || []), visited = new Set(store.visited || []);
    const log = store.visitLog && typeof store.visitLog === 'object' ? store.visitLog : {};
    const memberOf = id => (Array.isArray(store.collections) ? store.collections : []).filter(c => c && Array.isArray(c.places) && c.places.includes(id)).map(c => String(c.name || ''));
    return [...(store.custom || []), ...(store.osm || [])]
      .filter(p => p && typeof p.name === 'string' && Array.isArray(p.coordinates) && p.coordinates.length === 2 && p.coordinates.every(Number.isFinite))
      .map(p => {
        const dated = (Array.isArray(log[p.id]) ? log[p.id] : []).filter(v => typeof v === 'string' && v).sort();
        return {
          name: p.name, category: String(p.kind || ''), lat: p.coordinates[1], lng: p.coordinates[0], address: String(p.address || ''), note: String(p.note || ''),
          saved: saved.has(p.id), visited: visited.has(p.id) || (Array.isArray(log[p.id]) && log[p.id].length > 0),
          ...(window.OrientSpend ? OrientSpend.exportFacts(store, p.id) : { spent: '', ownership: '' }), visits: Array.isArray(log[p.id]) ? log[p.id].length : (visited.has(p.id) ? 1 : 0), last_visit: dated.length ? dated[dated.length - 1].slice(0, 10) : '', collections: memberOf(p.id),
        };
      });
  }

  const geojson = list => JSON.stringify({
    type: 'FeatureCollection',
    features: list.map(r => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lng, r.lat] }, properties: { name: r.name, category: r.category, address: r.address, note: r.note, saved: r.saved, visited: r.visited, visits: r.visits, last_visit: r.last_visit, spent: r.spent === '' ? null : Number(r.spent), ownership: r.ownership, collections: r.collections } })),
  }, null, 2);

  // A spreadsheet runs a cell that starts with = + - or @ as a formula, so those get a leading apostrophe.
  const cell = v => { let s = Array.isArray(v) ? v.join('; ') : String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const COLS = ['name', 'category', 'lat', 'lng', 'address', 'note', 'saved', 'visited', 'visits', 'last_visit', 'spent', 'ownership', 'collections'];
  const csv = list => [COLS.join(','), ...list.map(r => COLS.map(c => cell(r[c])).join(','))].join('\r\n') + '\r\n';

  const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const gpx = list => '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Orient" xmlns="http://www.topografix.com/GPX/1/1">\n' +
    list.map(r => '  <wpt lat="' + r.lat + '" lon="' + r.lng + '"><name>' + xml(r.name) + '</name>' + (r.note || r.address ? '<desc>' + xml([r.address, r.note].filter(Boolean).join(' · ')) + '</desc>' : '') + (r.category ? '<type>' + xml(r.category) + '</type>' : '') + '</wpt>').join('\n') + '\n</gpx>\n';

  const FORMATS = {
    geojson: { label: 'GeoJSON', build: geojson, type: 'application/geo+json', ext: 'geojson' },
    csv: { label: 'CSV', build: csv, type: 'text/csv', ext: 'csv' },
    gpx: { label: 'GPX', build: gpx, type: 'application/gpx+xml', ext: 'gpx' },
  };

  function download(format) {
    const f = FORMATS[format], list = rows(read());
    const blob = new Blob([(format === 'csv' ? '﻿' : '') + f.build(list)], { type: f.type });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'orient-places-' + new Date().toISOString().slice(0, 10) + '.' + f.ext; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    const status = document.querySelector('[data-open-export-status]');
    if (status) status.textContent = list.length ? list.length + ' place' + (list.length === 1 ? '' : 's') + ' saved as ' + f.label + '.' : 'There are no places to export yet.';
    return list.length;
  }

  function mount() {
    const tiles = document.querySelector('#set-data .set-tiles');
    if (!tiles || document.getElementById('open-export')) return;
    const row = document.createElement('div');
    row.id = 'open-export'; row.className = 'set-row open-export';
    row.innerHTML = '<div><b>Export your places for other apps</b><span>Names, categories, notes and visit counts as an open file. Your neighbor guide is never included.</span></div><div class="open-export-buttons">' +
      Object.entries(FORMATS).map(([k, f]) => '<button type="button" class="button" data-open-export="' + k + '">' + f.label + '</button>').join('') + '</div><p class="fine" role="status" data-open-export-status></p>';
    tiles.after(row);
    row.addEventListener('click', e => { const b = e.target.closest('[data-open-export]'); if (b) download(b.dataset.openExport); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  return { rows, geojson, csv, gpx, download };
})();
