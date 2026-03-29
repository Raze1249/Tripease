// routes/buses.js
const router = require('express').Router();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const Trip = require('../models/Trip');
const BUS_BASE = process.env.TRIP_BUS_API_URL;              // e.g. https://...
const BUS_KEY = process.env.TRIP_BUS_API_KEY;
const BUS_KEY_PARAM = process.env.TRIP_BUS_API_KEY_PARAM_NAME || '';
const BUS_CACHE_TTL = Number(process.env.BUS_CACHE_TTL_MS || (1000 * 60 * 60)); // 1h default
const FALLBACK_BUSES = [
  { id: 'demo-bus-1', operator: 'Orange Travels', source: 'Jaipur', destination: 'Delhi', departureTime: '07:00', arrivalTime: '13:30', duration: '6h 30m', price: 899, currency: 'INR', seatsAvailable: 12, imageUrl: 'https://source.unsplash.com/800x600/?bus,roadtrip' },
  { id: 'demo-bus-2', operator: 'GreenLine Express', source: 'Mumbai', destination: 'Pune', departureTime: '09:15', arrivalTime: '12:45', duration: '3h 30m', price: 599, currency: 'INR', seatsAvailable: 18, imageUrl: 'https://source.unsplash.com/800x600/?coach,bus' },
  { id: 'demo-bus-3', operator: 'Night Rider', source: 'Bengaluru', destination: 'Chennai', departureTime: '22:00', arrivalTime: '05:30', duration: '7h 30m', price: 1099, currency: 'INR', seatsAvailable: 7, imageUrl: 'https://source.unsplash.com/800x600/?sleeper,bus' }
];
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

unction getDemoBuses({ source = '', destination = '', limit = 20 } = {}) {
  const lim = Number(limit) || 20;
  const srcQ = String(source || '').trim().toLowerCase();
  const dstQ = String(destination || '').trim().toLowerCase();
  const filtered = FALLBACK_BUSES.filter((b) => {
    const sourceOk = !srcQ || b.source.toLowerCase().includes(srcQ);
    const destOk = !dstQ || b.destination.toLowerCase().includes(dstQ);
    return sourceOk && destOk;
  });
  return filtered.slice(0, lim);
}

// GET /api/buses?source=jaipur&destination=delhi&date=2025-12-01&limit=10
router.get('/', async (req, res) => {
  try {
     if (!BUS_BASE || !BUS_KEY) {
      const source = req.query.source || req.query.from || '';
      const destination = req.query.destination || req.query.to || '';
      const where = { type: 'bus' };
      if (source) where.fromCity = new RegExp(`^${source}$`, 'i');
      if (destination) where.toCity = new RegExp(`^${destination}$`, 'i');
      const localBuses = await Trip.find(where).select('-__v').limit(Number(req.query.limit || 20));
     if (localBuses.length) {
        return res.json({ data: localBuses, source: 'database', live: false });
      }
      return res.json({ data: getDemoBuses({ source, destination, limit: req.query.limit }), source: 'demo', live: false, demo: true });
    }

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
    const source = req.query.source || req.query.from || '';
    const destination = req.query.destination || req.query.to || '';
    res.json({ data: getDemoBuses({ source, destination, limit: req.query.limit }), source: 'demo', live: false, demo: true });
  }
});

module.exports = router;
