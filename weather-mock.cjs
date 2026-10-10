// Made-up weather for the checks: a forecast, an archive and an alert, so nothing real is contacted.
const pad = v => String(v).padStart(2, '0');
// The mock lives in New York time, like the map's home, so "today" and "this hour" line up with the app.
const local = new Date(Date.now() - 4 * 3600e3);
const iso = (d, h = 0, m = 0) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(h) + ':' + pad(m);
const dayStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
const forecast = (code = 3, opts = {}) => {
  const times = [], temp = [], pop = [], codes = [], isDay = [];
  for (let i = 0; i < 7 * 24; i++) { const d = new Date(dayStart.getTime() + i * 3600e3); times.push(iso(d, d.getUTCHours())); temp.push(12 + (i % 24 > 6 && i % 24 < 18 ? 6 : 0)); pop.push(opts.rainAt !== undefined && i === local.getUTCHours() + opts.rainAt ? 80 : 5); codes.push(code); isDay.push(i % 24 > 6 && i % 24 < 19 ? 1 : 0); }
  const days = Array.from({ length: 7 }, (_, i) => new Date(dayStart.getTime() + i * 864e5));
  return {
    latitude: 41.7, longitude: -83.5, timezone: 'America/New_York',
    current: { time: iso(local, local.getUTCHours(), 0), temperature_2m: opts.temp ?? 12.8, apparent_temperature: opts.feels ?? 11, relative_humidity_2m: 66, weather_code: code, is_day: 1, precipitation: 0, cloud_cover: 100, wind_speed_10m: opts.wind ?? 14, wind_direction_10m: 270 },
    hourly: { time: times, temperature_2m: temp, precipitation_probability: pop, weather_code: codes, is_day: isDay },
    daily: { time: days.map(d => iso(d).slice(0, 10)), weather_code: days.map(() => code), temperature_2m_max: days.map((_, i) => 20 + i), temperature_2m_min: days.map((_, i) => 8 + i), precipitation_sum: days.map((_, i) => i === 2 ? 6 : 0), precipitation_probability_max: days.map((_, i) => i === 2 ? 70 : 10), sunrise: days.map(d => iso(d, 7, 31)), sunset: days.map(d => iso(d, 19, 3)), uv_index_max: days.map(() => 4.2), wind_speed_10m_max: days.map(() => 22) },
  };
};
const archive = url => {
  const q = new URL(url).searchParams, a = q.get('start_date'), b = q.get('end_date');
  if (a === b) { const y = +a.slice(0, 4); return { daily: { time: [a], weather_code: [y % 2 ? 61 : 3], temperature_2m_max: [10 + (y % 10)], temperature_2m_min: [2 + (y % 5)], precipitation_sum: [y % 2 ? 3 : 0], snowfall_sum: [0] } }; }
  const time = [], hi = [], lo = [], pr = []; for (let y = 1991; y <= 2020; y++) for (let d = new Date(Date.UTC(y, 0, 1)); d.getUTCFullYear() === y; d = new Date(d.getTime() + 864e5)) { time.push(iso(d).slice(0, 10)); hi.push(14 + (y % 7)); lo.push(5 + (y % 4)); pr.push(y === 2003 ? 30 : 1); }
  return { daily: { time, temperature_2m_max: hi, temperature_2m_min: lo, precipitation_sum: pr } };
};
const alertOf = severe => ({ features: [{ properties: severe ? { event: 'Tornado Warning', severity: 'Extreme', headline: 'Tornado Warning until 8 PM EDT', description: 'Take shelter now.', instruction: 'Move to an interior room.', expires: new Date(Date.now() + 2 * 3600e3).toISOString(), areaDesc: 'Lucas, OH' } : { event: 'Wind Advisory', severity: 'Moderate', headline: 'Wind Advisory until 8 PM EDT', description: 'Southwest winds 25 to 35 mph with gusts up to 50 mph.', instruction: 'Secure loose objects.', expires: new Date(Date.now() + 5 * 3600e3).toISOString(), areaDesc: 'Lucas, OH' } }] });
const alert = alertOf(false);
module.exports = { forecast, archive, alert, alertOf, iso, pad, local, dayStart };
