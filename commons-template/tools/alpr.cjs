'use strict';
// Automated license plate readers (ALPRs), as mapped by volunteers on OpenStreetMap. This is the same data DeFlock (https://deflock.org)
// maps: every node tagged surveillance:type=ALPR. Orient reads it from OpenStreetMap's Overpass service on a schedule, keeps the
// facts the app shows (where, which way it faces, who runs it, what make) and publishes one small file. OpenStreetMap data is
// © OpenStreetMap contributors, available under the Open Database License (https://www.openstreetmap.org/copyright).

// The main server has the freshest data; the others are mirrors that can be weeks behind, so they are only a fallback.
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const text = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const round = v => Math.round(v * 1e5) / 1e5;
const COMPASS = { n: 0, nne: 22.5, ne: 45, ene: 67.5, e: 90, ese: 112.5, se: 135, sse: 157.5, s: 180, ssw: 202.5, sw: 225, wsw: 247.5, w: 270, wnw: 292.5, nw: 315, nnw: 337.5, north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 };

// OpenStreetMap writes direction as degrees ("345"), a compass point ("NE"), or several ("90;270"). The first reading is used.
function bearing(v) {
  const first = String(v ?? '').split(/[;,]/)[0].trim().toLowerCase();
  if (!first) return null;
  if (/^-?\d+(\.\d+)?$/.test(first)) return ((Math.round(Number(first)) % 360) + 360) % 360;
  return first in COMPASS ? COMPASS[first] : null;
}

// an exact tag match is cheap for the server; a regular expression on the key made the main server time out
const query = bbox => '[out:json][timeout:90];node["surveillance:type"="ALPR"](' + [bbox[1], bbox[0], bbox[3], bbox[2]].join(',') + ');out body;';

async function fetchNodes(bbox, { endpoints = ENDPOINTS, fetchImpl = fetch, pauseMs = 6000 } = {}) {
  const errors = [];
  for (let round = 0; round < 2; round++) for (const url of endpoints) {
    if (round) await new Promise(r => setTimeout(r, pauseMs));
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 100000);
    try {
      const r = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'orient-commons-civic (+https://github.com/ragingapathy/orient)' }, body: 'data=' + encodeURIComponent(query(bbox)), signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const json = await r.json();
      if (!json || !Array.isArray(json.elements)) throw new Error('unexpected reply');
      return { elements: json.elements, asOf: (json.osm3s && typeof json.osm3s.timestamp_osm_base === 'string') ? json.osm3s.timestamp_osm_base : '' };
    } catch (e) { errors.push(new URL(url).hostname + ': ' + (e && e.message)); } finally { clearTimeout(timer); }
  }
  throw new Error(errors.join('; ') || 'no Overpass endpoint answered');
}

function normalize(elements, { max = 3000 } = {}) {
  const items = [];
  for (const e of Array.isArray(elements) ? elements : []) {
    if (!e || e.type !== 'node' || !Number.isFinite(e.lat) || !Number.isFinite(e.lon) || Math.abs(e.lat) > 85 || Math.abs(e.lon) > 180) continue;
    const t = e.tags || {};
    items.push({
      id: 'osm:node/' + e.id, lat: round(e.lat), lng: round(e.lon), direction: bearing(t.direction ?? t['camera:direction']),
      manufacturer: text(t.manufacturer || t.brand, 60), operator: text(t.operator, 80), zone: text(t['surveillance:zone'], 30), mount: text(t['camera:mount'], 30), kind: text(t['camera:type'], 20), model: text(t.model, 60),
    });
    if (items.length >= max) break;
  }
  return items.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

module.exports = { fetchNodes, normalize, bearing, query };
