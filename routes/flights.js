const router = require('express').Router();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const FLIGHT_BASE = process.env.TRIP_FLIGHT_API_URL;
const FLIGHT_KEY = process.env.TRIP_FLIGHT_API_KEY;
const FLIGHT_KEY_PARAM = process.env.TRIP_FLIGHT_API_KEY_PARAM_NAME || '';
const FLIGHT_CACHE_TTL = Number(process.env.FLIGHT_CACHE_TTL_MS || (1000 * 60 * 30));

if (!FLIGHT_BASE || !FLIGHT_KEY) {
  console.warn('routes/flights: TRIP_FLIGHT_API_URL or TRIP_FLIGHT_API_KEY not set. Falling back to mock flights.');
}

const cache = new Map();
const cacheSet = (k, v) => cache.set(k, { v, ts: Date.now() });
const cacheGet = (k, ttl = FLIGHT_CACHE_TTL) => {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > ttl) {
    cache.delete(k);
    return null;
  }
  return e.v;
};

function buildFlightUrl(q = {}) {
  const params = new URLSearchParams(q);
  if (FLIGHT_KEY_PARAM) params.set(FLIGHT_KEY_PARAM, FLIGHT_KEY);
  return `${FLIGHT_BASE}${params.toString() ? `?${params.toString()}` : ''}`;
}

function normalizeFlight(raw, fallback = {}) {
  return {
    id: raw.id || raw.flight_id || raw.number || raw.flightNumber || `FLT-${Date.now()}`,
    source: raw.source || raw.origin || raw.from || fallback.source || '',
    destination: raw.destination || raw.to || raw.arrival || fallback.destination || '',
    date: raw.date || raw.departureDate || raw.departure_date || fallback.departureDate || '',
    departure: raw.departure || raw.departureTime || raw.departure_time || '',
    duration: raw.duration || raw.travelTime || raw.elapsed || '',
    carrier: raw.carrier || raw.airline || raw.airlineName || 'Airline',
    price: (raw.price && (raw.price.total || raw.price.amount)) || raw.fare || raw.amount || raw.price || null,
    currency: raw.currency || (raw.price && raw.price.currency) || 'USD',
    raw
  };
}

function generateMockFlights(source, destination, departureDate) {
  const flights = [];
  const carriers = ['Air Tripease', 'Global Wings', 'Oceanic Air', 'SkyPath'];
  const seed = source.length + destination.length + departureDate.length;

  let random = (s) => {
    s = Math.sin(s++) * 10000;
    return s - Math.floor(s);
  };

  for (let i = 0; i < 5; i += 1) {
    const departureHour = 6 + Math.floor(random(seed + i) * 16);
    const departureMinute = Math.floor(random(seed + i + 10) * 60);
    const departure = `${String(departureHour).padStart(2, '0')}:${String(departureMinute).padStart(2, '0')}`;

    const durationHours = 2 + Math.floor(random(seed + i + 20) * 8);
    const durationMinutes = Math.floor(random(seed + i + 30) * 60);

    flights.push({
      id: `FLT-${Math.floor(random(seed + i + 50) * 99999)}`,
      source,
      destination,
      date: departureDate,
      departure,
      duration: `${durationHours}h ${durationMinutes}m`,
      carrier: carriers[Math.floor(random(seed + i + 60) * carriers.length)],
      price: 100 + Math.floor(random(seed + i + 40) * 900),
      currency: 'USD',
      live: false
    });
  }

  return flights;
}

router.post('/', async (req, res) => {
  try {
    const { source, destination, departureDate } = req.body || {};

    if (!source || !destination || !departureDate) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    if (!FLIGHT_BASE || !FLIGHT_KEY) {
      return res.json(generateMockFlights(source, destination, departureDate));
    }

    const requestQuery = {
      source,
      destination,
      departureDate
    };

    const cacheKey = `flights:${new URLSearchParams(requestQuery).toString()}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const url = buildFlightUrl(requestQuery);
    const headers = {};
    if (FLIGHT_KEY && !FLIGHT_KEY_PARAM) headers.Authorization = `Bearer ${FLIGHT_KEY}`;

    const providerRes = await fetch(url, { headers, timeout: 20000 });
    const providerBody = await providerRes.json().catch(() => null);

    if (!providerRes.ok) {
      return res.status(providerRes.status).json({
        message: 'Flight provider error',
        details: providerBody || providerRes.statusText
      });
    }

    let items = [];
    if (Array.isArray(providerBody)) items = providerBody;
    else if (Array.isArray(providerBody.data)) items = providerBody.data;
    else if (Array.isArray(providerBody.flights)) items = providerBody.flights;
    else if (Array.isArray(providerBody.results)) items = providerBody.results;
    else if (providerBody && typeof providerBody === 'object') {
      const arrKey = Object.keys(providerBody).find((k) => Array.isArray(providerBody[k]));
      if (arrKey) items = providerBody[arrKey];
    }

    const normalized = items.map((f) => ({ ...normalizeFlight(f, { source, destination, departureDate }), live: true }));
    cacheSet(cacheKey, normalized);

    return res.json(normalized);
  } catch (err) {
    console.error('routes/flights error:', err && err.stack ? err.stack : String(err));
    return res.status(500).json({ message: 'Failed to fetch flights', error: String(err.message || err) });
  }
});

module.exports = router;
