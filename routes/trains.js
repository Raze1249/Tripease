// routes/trains.js
const router = require('express').Router();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const TRAIN_BASE = process.env.TRIP_TRAIN_API_URL;
const TRAIN_KEY = process.env.TRIP_TRAIN_API_KEY;
const TRAIN_KEY_PARAM = process.env.TRIP_TRAIN_API_KEY_PARAM_NAME || '';
const TRAIN_CACHE_TTL = Number(process.env.TRAIN_CACHE_TTL_MS || (1000 * 60 * 60));

if (!TRAIN_BASE || !TRAIN_KEY) {
  console.warn('routes/trains: TRIP_TRAIN_API_URL or TRIP_TRAIN_API_KEY not set.');
}

const cache = new Map();
const cacheSet = (k, v) => cache.set(k, { v, ts: Date.now() });
const cacheGet = (k, ttl = TRAIN_CACHE_TTL) => {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > ttl) { cache.delete(k); return null; }
  return e.v;
};

function buildTrainUrl(q = {}) {
  const params = new URLSearchParams(q);
  if (TRAIN_KEY_PARAM) params.set(TRAIN_KEY_PARAM, TRAIN_KEY);
  return `${TRAIN_BASE}${params.toString() ? `?${params.toString()}` : ''}`;
}

// normalize provider train object into our shape
function normalizeTrain(raw) {
  const id = raw.id || raw.train_id || raw.trainNumber || raw.code || `${raw.number || 'train'}-${raw.departureTime || ''}`;
  const name = raw.name || raw.trainName || `Train ${raw.number || ''}`;
  const number = raw.number || raw.trainNumber || '';
  const source = raw.source || raw.from || raw.origin || raw.departureStation || '';
  const destination = raw.destination || raw.to || raw.arrivalStation || '';
  const departureTime = raw.departureTime || raw.departure || raw.departure_time || '';
  const arrivalTime = raw.arrivalTime || raw.arrival || raw.arrival_time || '';
  const duration = raw.duration || raw.journeyTime || '';
  const classType = raw.class || raw.classType || raw.coach || '';
  const price = (raw.fare && raw.fare.total) || raw.fare || raw.price || null;
  const currency = raw.currency || (raw.fare && raw.fare.currency) || 'INR';
  const seatsAvailable = raw.availableSeats || raw.seats || null;
  const imageUrl = raw.imageUrl || `https://source.unsplash.com/800x600/?train,${encodeURIComponent(destination || 'railway')}`;

  return { id, name, number, source, destination, departureTime, arrivalTime, duration, classType, price, currency, seatsAvailable, imageUrl, raw };
}

// GET /api/trains?source=jaipur&destination=delhi&date=2025-12-01&class=SL
router.get('/', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const cacheKey = `trains:${qs}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ data: cached, cached: true });

    const q = { ...req.query };
    delete q._;

    const url = buildTrainUrl(q);
    const headers = {};
    if (TRAIN_KEY && !TRAIN_KEY_PARAM) headers['Authorization'] = `Bearer ${TRAIN_KEY}`;

    const r = await fetch(url, { headers, timeout: 15000 });
    const body = await r.json().catch(() => null);

    if (!r.ok) {
      return res.status(r.status).json({ message: 'Train provider error', details: body || r.statusText });
    }

    let items = [];
    if (Array.isArray(body)) items = body;
    else if (Array.isArray(body.results)) items = body.results;
    else if (Array.isArray(body.trains)) items = body.trains;
    else if (Array.isArray(body.data)) items = body.data;
    else if (body && typeof body === 'object') {
      const arrKey = Object.keys(body).find(k => Array.isArray(body[k]));
      if (arrKey) items = body[arrKey];
    }

    const normalized = items.map(normalizeTrain);
    cacheSet(cacheKey, normalized);
    res.json({ data: normalized, cached: false });
  } catch (err) {
    console.error('routes/trains error:', err && err.stack ? err.stack : String(err));
    res.status(500).json({ message: 'Failed to fetch trains', error: String(err.message || err) });
  }
});

module.exports = router;
