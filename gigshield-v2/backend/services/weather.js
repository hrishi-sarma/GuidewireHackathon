/**
 * Weather service
 * Fetches real data from OpenWeatherMap when OPENWEATHER_API_KEY is set.
 * Falls back to deterministic mock data when the key is missing or request fails.
 */

const axios = require('axios');

const OWM_KEY    = process.env.OPENWEATHER_API_KEY;
const OWM_BASE   = 'https://api.openweathermap.org/data/2.5';
const LIVE       = !!(OWM_KEY && OWM_KEY !== 'your_key_here');

let warnedNoKey = false;

// Zone GPS coordinates (Synchronized with 30-zone national database)
const ZONE_COORDS = {
  z1: { lat: 19.1136, lon: 72.8697 }, z2: { lat: 19.0728, lon: 72.8826 }, z3: { lat: 19.0544, lon: 72.8405 }, z4: { lat: 19.1176, lon: 72.9060 },
  z5: { lat: 28.5921, lon: 77.0460 }, z6: { lat: 28.5708, lon: 77.2435 }, z7: { lat: 28.7041, lon: 77.1025 }, z8: { lat: 28.4950, lon: 77.0878 },
  z9: { lat: 28.6258, lon: 77.3685 }, z10: { lat: 12.9352, lon: 77.6245 }, z11: { lat: 12.9698, lon: 77.7499 }, z12: { lat: 12.9716, lon: 77.6412 },
  z13: { lat: 12.8452, lon: 77.6632 }, z14: { lat: 13.0418, lon: 80.2341 }, z15: { lat: 12.9816, lon: 80.2180 }, z16: { lat: 13.0012, lon: 80.2565 },
  z17: { lat: 17.4483, lon: 78.3915 }, z18: { lat: 17.4401, lon: 78.3489 }, z19: { lat: 17.4156, lon: 78.4347 }, z20: { lat: 18.5913, lon: 73.7389 },
  z21: { lat: 18.5679, lon: 73.9143 }, z22: { lat: 18.5074, lon: 73.8077 }, z23: { lat: 22.5868, lon: 88.4178 }, z24: { lat: 22.5769, lon: 88.4727 },
  z25: { lat: 22.5529, lon: 88.3518 }, z26: { lat: 23.0305, lon: 72.5075 }, z27: { lat: 23.0350, lon: 72.5600 }, z28: { lat: 26.8467, lon: 80.9462 },
  z29: { lat: 26.8797, lon: 80.9847 }, z30: { lat: 26.8531, lon: 75.8050 },
};

function applyDrift(weather) {
  const min = Math.floor(Date.now() / 60000); // Minute-based bucketing
  const seed = (min % 100);
  // Stochastic micro-variations (+/- 0.2 units)
  const dTemp   = ((seed % 5) - 2) * 0.1;
  const dRain   = ((seed % 3) - 1) * 0.1;
  const dAQI    = (seed % 7) - 3;

  return {
    ...weather,
    temp_celsius:    parseFloat((weather.temp_celsius + dTemp).toFixed(1)),
    rainfall_mm_hr:  Math.max(0, parseFloat((weather.rainfall_mm_hr + dRain).toFixed(1))),
    aqi:               Math.max(1, weather.aqi + dAQI),
  };
}

async function fetchLive(zone) {
  const coords = ZONE_COORDS[zone.id];
  if (!coords) throw new Error(`No coords for zone ${zone.id}`);

  const [weatherRes, aqiRes] = await Promise.allSettled([
    axios.get(`${OWM_BASE}/weather`, {
      params: { lat: coords.lat, lon: coords.lon, appid: OWM_KEY, units: 'metric' },
      timeout: 8000,
    }),
    axios.get(`${OWM_BASE}/air_pollution`, {
      params: { lat: coords.lat, lon: coords.lon, appid: OWM_KEY },
      timeout: 6000,
    }),
  ]);

  if (weatherRes.status === 'rejected') throw weatherRes.reason;
  const w = weatherRes.value.data;

  const rainMmHr    = w.rain?.['1h'] ?? 0;
  const tempCelsius = w.main?.temp ?? 30;
  const humidity    = w.main?.humidity ?? 60;
  const weatherId   = w.weather?.[0]?.id ?? 800;

  // Use real AQI if available, else proxy
  const OWM_AQI_MAP = { 1: 40, 2: 80, 3: 160, 4: 260, 5: 380 };
  const aqi = aqiRes.status === 'fulfilled'
    ? (OWM_AQI_MAP[aqiRes.value.data.list?.[0]?.main?.aqi] ?? aqiProxy(humidity, weatherId, zone.city))
    : aqiProxy(humidity, weatherId, zone.city);

  return {
    zone_id:          zone.id,
    zone_name:        zone.name,
    rainfall_mm_hr:   parseFloat(rainMmHr.toFixed(2)),
    temp_celsius:     parseFloat(tempCelsius.toFixed(1)),
    aqi,
    humidity_pct:     humidity,
    wind_kmh:         parseFloat(((w.wind?.speed ?? 0) * 3.6).toFixed(1)),
    curfew_active:    0,
    road_blocked_pct: floodProxy(rainMmHr, zone),
    fetched_at:       new Date().toISOString(),
    source:           'openweathermap',
  };
}

function getSeed(zoneId) {
  const min = Math.floor(Date.now() / 60000);
  const zid = parseInt(zoneId.replace('z', '')) || 0;
  // Deterministic seed 0-1 based on zone and minute
  return (((min * 7 + zid * 13) % 100) / 100);
}

function mockData(zone) {
  const s = getSeed(zone.id);
  return {
    zone_id:          zone.id,
    zone_name:        zone.name,
    rainfall_mm_hr:   parseFloat((s * 6).toFixed(2)),
    temp_celsius:     parseFloat((28 + s * 8).toFixed(1)),
    aqi:              Math.round(80 + s * 70),
    humidity_pct:     Math.round(55 + s * 35),
    wind_kmh:         parseFloat((8 + s * 18).toFixed(1)),
    curfew_active:    0,
    road_blocked_pct: parseFloat((s * 15).toFixed(1)),
    fetched_at:       new Date().toISOString(),
    source:           'mock',
  };
}

function simData(zone, type) {
  const s = getSeed(zone.id);
  return {
    zone_id:          zone.id,
    zone_name:        zone.name,
    rainfall_mm_hr:   type === 'rain'   ? 22 + s * 12 : 1,
    temp_celsius:     type === 'heat'   ? 43 + s * 2  : 31,
    aqi:              type === 'aqi'    ? 320 + s * 40 : 82,
    curfew_active:    type === 'curfew' ? 1 : 0,
    road_blocked_pct: type === 'flood'  ? 78 + s * 12 : 5,
    humidity_pct:     72,
    wind_kmh:         14,
    fetched_at:       new Date().toISOString(),
    source:           'simulation',
  };
}

async function getWeather(zone) {
  if (global.SIMULATE_DISRUPTION) {
    return applyDrift(simData(zone, global.SIMULATE_TYPE || 'rain'));
  }

  if (!LIVE) {
    if (!warnedNoKey) {
      console.warn('⚠️  No OPENWEATHER_API_KEY — using mock weather data');
      warnedNoKey = true;
    }
    return applyDrift(mockData(zone));
  }

  try {
    const data = await fetchLive(zone);
    console.log(`🌤 [OWM] ${zone.name}: ${data.temp_celsius}°C rain=${data.rainfall_mm_hr}mm/hr AQI=${data.aqi}`);
    return applyDrift(data);
  } catch (err) {
    console.error(`❌ OWM failed for ${zone.name}: ${err.message} — using mock`);
    return applyDrift(mockData(zone));
  }
}

module.exports = { getWeather, LIVE };
