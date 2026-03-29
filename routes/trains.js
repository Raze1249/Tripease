// routes/trains.js
const router = require('express').Router();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const Trip = require('../models/Trip');
const TRAIN_BASE = process.env.TRIP_TRAIN_API_URL;
const TRAIN_KEY = process.env.TRIP_TRAIN_API_KEY;
const TRAIN_KEY_PARAM = process.env.TRIP_TRAIN_API_KEY_PARAM_NAME || '';
const TRAIN_CACHE_TTL = Number(process.env.TRAIN_CACHE_TTL_MS || (1000 * 60 * 30));
const FALLBACK_TRAINS = [
  { id: 'demo-train-1', name: 'Shatabdi Express', number: '12001', source: 'Delhi', destination: 'Jaipur', departureTime: '06:05', arrivalTime: '10:40', duration: '4h 35m', classType: 'Chair Car', price: 1250, currency: 'INR', seatsAvailable: 23, imageUrl: 'https://tse4.mm.bing.net/th/id/OIP.1NiQO9fL6Vzx4gZNP5VE6AHaFc?pid=Api&P=0&h=180' },
  { id: 'demo-train-2', name: 'Intercity Express', number: '12679', source: 'Bengaluru', destination: 'Chennai', departureTime: '07:00', arrivalTime: '12:10', duration: '5h 10m', classType: '2S', price: 680, currency: 'INR', seatsAvailable: 40, imageUrl: 'https://tse4.mm.bing.net/th/id/OIP.QmCQtBwJDrjc1lYM5ceyjgHaE7?pid=Api&P=0&h=180' },
 { id: 'demo-train-3', name: 'Deccan Queen', number: '12123', source: 'Mumbai', destination: 'Pune', departureTime: '17:10', arrivalTime: '20:25', duration: '3h 15m', classType: 'CC', price: 550, currency: 'INR', seatsAvailable: 32, imageUrl: 'https://tse4.mm.bing.net/th/id/OIP.tGo_iMqJCQxcffKKFbgUTQHaEG?pid=Api&P=0&h=180' },
  { id: 'demo-train-4', name: 'Pink City Intercity', number: '12985', source: 'Jaipur', destination: 'Delhi', departureTime: '08:15', arrivalTime: '12:50', duration: '4h 35m', classType: 'CC', price: 990, currency: 'INR', seatsAvailable: 29, imageUrl: 'https://tse1.mm.bing.net/th/id/OIP.Ua7bhJruRKIQqeA_7O1nFQHaEK?pid=Api&P=0&h=180' },
  { id: 'demo-train-5', name: 'Marudhar Express', number: '14853', source: 'Jaipur', destination: 'Jodhpur', departureTime: '14:20', arrivalTime: '20:10', duration: '5h 50m', classType: 'SL', price: 430, currency: 'INR', seatsAvailable: 56, imageUrl: 'https://tse2.mm.bing.net/th/id/OIP.FfoCgGOv566kbGr4_T0U3gHaEK?pid=Api&P=0&h=180' }
];

if (!TRAIN_BASE || !TRAIN_KEY) {
  console.warn('routes/trains: TRIP_TRAIN_API_URL or TRIP_TRAIN_API_KEY not set. Falling back to database trains.');
}

const cache = new Map();
const cacheSet = (k, v) => cache.set(k, { v, ts: Date.now() });
const cacheGet = (k, ttl = TRAIN_CACHE_TTL) => {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > ttl) {
    cache.delete(k);
    return null;
  }
  return e.v;
};

function buildTrainUrl(q = {}) {
  const params = new URLSearchParams(q);
  if (TRAIN_KEY_PARAM) params.set(TRAIN_KEY_PARAM, TRAIN_KEY);
  return `${TRAIN_BASE}${params.toString() ? `?${params.toString()}` : ''}`;
}

function normalizeTrain(raw, fallback = {}) {
  return {
    id: raw.id || raw.train_id || raw.number || raw.code || raw.name,
    name: raw.name || raw.trainName || 'Train',
    number: raw.number || raw.trainNumber || '',
    source: raw.source || raw.from || raw.origin || fallback.source || '',
    destination: raw.destination || raw.to || raw.arrival || fallback.destination || '',
    departureTime: raw.departureTime || raw.departure || raw.departure_time || '',
    arrivalTime: raw.arrivalTime || raw.arrival || raw.arrival_time || '',
    duration: raw.duration || raw.journeyTime || '',
    classType: raw.classType || raw.class || raw.cabin || fallback.classType || '',
    price: (raw.price && (raw.price.total || raw.price.amount)) || raw.fare || raw.amount || raw.price || null,
    currency: raw.currency || (raw.price && raw.price.currency) || 'INR',
    seatsAvailable: raw.seatsAvailable || raw.availableSeats || raw.seats || null,
    imageUrl: raw.imageUrl || `https://source.unsplash.com/800x600/?train,${encodeURIComponent(fallback.destination || 'travel')}`,
    raw
  };
}
function getDemoTrains({ source = '', destination = '', classType = '', limit = 20 } = {}) {
  const lim = Number(limit) || 20;
  const srcQ = String(source || '').trim().toLowerCase();
  const dstQ = String(destination || '').trim().toLowerCase();
  const clsQ = String(classType || '').trim().toLowerCase();
  const sourceCity = String(source || '').trim();
  const destinationCity = String(destination || '').trim();
  const filtered = FALLBACK_TRAINS.filter((t) => {
    const sourceOk = !srcQ || t.source.toLowerCase().includes(srcQ);
    const destOk = !dstQ || t.destination.toLowerCase().includes(dstQ);
    const classOk = !clsQ || t.classType.toLowerCase().includes(clsQ);
    return sourceOk && destOk && classOk;
  });
   const list = filtered.length ? filtered : FALLBACK_TRAINS.map((t, i) => ({
    ...t,
    id: `${t.id}-${sourceCity || 'from'}-${destinationCity || 'to'}-${i + 1}`,
    source: sourceCity || t.source,
    destination: destinationCity || t.destination
  }));
  return list.slice(0, lim);
}

router.get('/', async (req, res) => {
  try {
    const source = req.query.source || req.query.from;
    const destination = req.query.destination || req.query.to;
    const date = req.query.date || '';
    const classType = req.query.classType || '';
   if (!source || !destination) {
      return res.status(400).json({
         message: 'source/from and destination/to query parameters are required'
      });
    }

    if (!TRAIN_BASE || !TRAIN_KEY) {
      const trains = await Trip.find({
        type: 'train',
        fromCity: new RegExp(`^${source}$`, 'i'),
        toCity: new RegExp(`^${destination}$`, 'i')
      }).select('-__v');

      if (trains.length) {
        return res.json({ source: 'database', count: trains.length, data: trains });
      }
      const demoTrains = getDemoTrains({ source, destination, classType, limit: req.query.limit });
      return res.json({
        source: 'demo',
        count: demoTrains.length,
        data: demoTrains,
        demo: true
      });
    }

    const requestQuery = { source, destination, date, classType };
    const cacheKey = `trains:${new URLSearchParams(requestQuery).toString()}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ data: cached, cached: true, source: 'provider' });

    const url = buildTrainUrl(requestQuery);
    const headers = {};
    if (TRAIN_KEY && !TRAIN_KEY_PARAM) headers.Authorization = `Bearer ${TRAIN_KEY}`;

    const providerRes = await fetch(url, { headers, timeout: 20000 });
    const providerBody = await providerRes.json().catch(() => null);

    if (!providerRes.ok) {
      return res.status(providerRes.status).json({
        message: 'Train provider error',
        details: providerBody || providerRes.statusText
      });
    }

    // fetch from MongoDB (NO API)
    let items = [];
    if (Array.isArray(providerBody)) items = providerBody;
    else if (Array.isArray(providerBody.data)) items = providerBody.data;
    else if (Array.isArray(providerBody.trains)) items = providerBody.trains;
    else if (Array.isArray(providerBody.results)) items = providerBody.results;
    else if (providerBody && typeof providerBody === 'object') {
      const arrKey = Object.keys(providerBody).find((k) => Array.isArray(providerBody[k]));
      if (arrKey) items = providerBody[arrKey];
    }


    const normalized = items.map((t) => normalizeTrain(t, { source, destination, classType }));
    cacheSet(cacheKey, normalized);

    return res.json({ data: normalized, cached: false, source: 'provider' });

  } catch (err) {
console.error('Train search error:', err);
    const source = req.query.source || req.query.from || '';
    const destination = req.query.destination || req.query.to || '';
    const classType = req.query.classType || '';
    const demoTrains = getDemoTrains({ source, destination, classType, limit: req.query.limit });
    return res.json({ source: 'demo', count: demoTrains.length, data: demoTrains, demo: true });
  }
});

module.exports = router;
