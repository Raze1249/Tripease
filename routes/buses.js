// routes/buses.js
const router = require('express').Router();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const BUS_BASE = process.env.TRIP_BUS_API_URL;              // e.g. https://...
const BUS_KEY = process.env.TRIP_BUS_API_KEY;
const BUS_KEY_PARAM = process.env.TRIP_BUS_API_KEY_PARAM_NAME || '';
const BUS_CACHE_TTL = Number(process.env.BUS_CACHE_TTL_MS || (1000 * 60 * 60)); // 1h default

if (!BUS_BASE || !BUS_KEY) {
  console.warn('routes/buses: TRIP_BUS_API_URL or TRIP_BUS_API_KEY not set.');
}

// simple in-memory cache
const cache = new Map();
const cacheSet = (k, v) => cache.set(k, { v, ts: Date.now() });
const cacheGet = (k, ttl = BUS_CACHE_TTL) => {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > ttl) { cache.delete(k); return null; }
  return e.v;
};

// provider URL builder
function buildBusUrl(q = {}) {
  const params = new URLSearchParams(q);
  if (BUS_KEY_PARAM) params.set(BUS_KEY_PARAM, BUS_KEY);   // query param auth
  return `${BUS_BASE}${params.toString() ? `?${params.toString()}` : ''}`;
}

// normalize provider bus object into our shape
function normalizeBus(raw) {
  const id = raw.id || raw.bus_id || raw.trip_id || raw.code || `${raw.operator || 'bus'}-${raw.departureTime || ''}`;
  const operator = raw.operator || raw.operatorName || raw.company || 'Bus Operator';
  const source = raw.source || raw.from || raw.origin || raw.departureCity || '';
  const destination = raw.destination || raw.to || raw.arrivalCity || '';
  const departureTime = raw.departureTime || raw.departure || raw.start_time || '';
  const arrivalTime = raw.arrivalTime || raw.arrival || raw.end_time || '';
  const duration = raw.duration || raw.journeyTime || '';
  const price = (raw.fare && raw.fare.total) || raw.fare || raw.price || null;
  const currency = raw.currency || (raw.fare && raw.fare.currency) || 'INR';
  const seatsAvailable = raw.availableSeats || raw.seats || null;
  const imageUrl = raw.imageUrl || `https://source.unsplash.com/800x600/?bus,${encodeURIComponent(destination || 'travel')}`;

  return { id, operator, source, destination, departureTime, arrivalTime, duration, price, currency, seatsAvailable, imageUrl, raw };
}

// GET /api/buses?source=jaipur&destination=delhi&date=2025-12-01&limit=10
router.get('/', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const cacheKey = `buses:${qs}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ data: cached, cached: true });

    // copy query and remove any internal keys if you add them later
    const q = { ...req.query };
    delete q._;

    const url = buildBusUrl(q);
    const headers = {};

    // header auth style if BUS_KEY_PARAM not set
    if (BUS_KEY && !BUS_KEY_PARAM) headers['Authorization'] = `Bearer ${BUS_KEY}`;

    const r = await fetch(url, { headers, timeout: 15000 });
    const body = await r.json().catch(() => null);

    if (!r.ok) {
      return res.status(r.status).json({ message: 'Bus provider error', details: body || r.statusText });
    }

    let items = [];
    if (Array.isArray(body)) items = body;
    else if (Array.isArray(body.results)) items = body.results;
    else if (Array.isArray(body.buses)) items = body.buses;
    else if (Array.isArray(body.data)) items = body.data;
    else if (body && typeof body === 'object') {
      const arrKey = Object.keys(body).find(k => Array.isArray(body[k]));
      if (arrKey) items = body[arrKey];
    }

    const normalized = items.map(normalizeBus);
    cacheSet(cacheKey, normalized);
    res.json({ data: normalized, cached: false });
  } catch (err) {
    console.error('routes/buses error:', err && err.stack ? err.stack : String(err));
    res.status(500).json({ message: 'Failed to fetch buses', error: String(err.message || err) });
  }
});

module.exports = router;
