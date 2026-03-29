// routes/hotels.js
const router = require('express').Router();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const Trip = require('../models/Trip');
// env
const HOTEL_BASE = process.env.TRIP_HOTEL_API_URL; // e.g. https://api.example-hotels.com/v1/search
const HOTEL_KEY = process.env.TRIP_HOTEL_API_KEY;
const HOTEL_KEY_PARAM = process.env.TRIP_HOTEL_API_KEY_PARAM_NAME || ''; // e.g. 'api_key'
const CACHE_TTL = Number(process.env.HOTEL_CACHE_TTL_MS || (1000 * 60 * 60)); // 1h default
const FALLBACK_HOTELS = [
  { id: 'demo-hotel-1', name: 'Seaside Bliss Resort', city: 'Goa', country: 'India', price: 6500, currency: 'INR', rating: 4.5, imageUrl: 'https://source.unsplash.com/800x600/?resort,beach', description: 'Beachfront stay with pool and breakfast.', amenities: ['WiFi', 'Pool', 'Breakfast'] },
  { id: 'demo-hotel-2', name: 'Royal Heritage Haveli', city: 'Jaipur', country: 'India', price: 5200, currency: 'INR', rating: 4.3, imageUrl: 'https://source.unsplash.com/800x600/?heritage,hotel', description: 'Heritage-style rooms in the old city.', amenities: ['WiFi', 'Parking', 'Restaurant'] },
 { id: 'demo-hotel-3', name: 'Urban Nest Hotel', city: 'Bengaluru', country: 'India', price: 4300, currency: 'INR', rating: 4.1, imageUrl: 'https://source.unsplash.com/800x600/?city,hotel', description: 'Modern business hotel near tech parks.', amenities: ['WiFi', 'Gym', 'Airport Shuttle'] },
  { id: 'demo-hotel-4', name: 'Pink City Palace Stay', city: 'Jaipur', country: 'India', price: 6100, currency: 'INR', rating: 4.6, imageUrl: 'https://source.unsplash.com/800x600/?jaipur,hotel', description: 'Boutique palace-style hotel near Hawa Mahal.', amenities: ['WiFi', 'Breakfast', 'Airport Transfer'] },
  { id: 'demo-hotel-5', name: 'Amber Fort View Residency', city: 'Jaipur', country: 'India', price: 4700, currency: 'INR', rating: 4.2, imageUrl: 'https://source.unsplash.com/800x600/?rajasthan,hotel', description: 'Comfort stay with rooftop dining and city tours.', amenities: ['WiFi', 'Restaurant', 'Tour Desk'] }
];
if (!HOTEL_BASE || !HOTEL_KEY) {
  console.warn('routes/hotels: HOTEL_BASE or HOTEL_KEY not set. Add TRIP_HOTEL_API_URL and TRIP_HOTEL_API_KEY to .env.');
}

// Simple in-memory cache map
const cache = new Map();
function cacheSet(key, value) { cache.set(key, { value, ts: Date.now() }); }
function cacheGet(key, ttl = CACHE_TTL) {
  const e = cache.get(key);
  if (!e) return null;
  if ((Date.now() - e.ts) > ttl) { cache.delete(key); return null; }
  return e.value;
}

// Helper: build external request url with provider params
function buildProviderUrl(q = {}) {
  // q may contain location, checkin, checkout, guests, limit, etc. We forward them as query params.
  const params = new URLSearchParams(q);

  // Add API key as query param if provider requires that style
  if (HOTEL_KEY_PARAM) params.set(HOTEL_KEY_PARAM, HOTEL_KEY);

  return `${HOTEL_BASE}${params.toString() ? ('?' + params.toString()) : ''}`;
}

// Normalize provider response to our shape:
// { id, name, address, city, country, price, currency, rating, imageUrl, description, amenities }
function normalizeHotel(raw) {
  // Try common field names; adapt here to your provider's response
  const id = raw.id || raw.hotel_id || raw.property_id || raw.code || raw.name;
  const name = raw.name || raw.hotel_name || raw.property_name || 'Hotel';
  const address = raw.address || raw.location?.address || raw.hotel_address || '';
  const city = raw.city || raw.location?.city || raw.address?.city || '';
  const country = raw.country || raw.location?.country || raw.address?.country || '';
  const price = (raw.price && (raw.price.total || raw.price.amount)) || raw.price || raw.rate || null;
  const currency = raw.currency || (raw.price && raw.price.currency) || 'USD';
  const rating = raw.rating || raw.stars || raw.review_score || null;
  // images: provider might have array raw.images[0].url etc.
  const imageUrl = raw.image || raw.images?.[0] || raw.photos?.[0]?.url || `https://source.unsplash.com/800x600/?hotel,${encodeURIComponent(name)}`;
  const description = raw.description || raw.summary || raw.short_description || '';
  const amenities = raw.amenities || raw.facilities || [];

  return { id, name, address, city, country, price, currency, rating, imageUrl, description, amenities, raw };
}

function getDemoHotels({ location = '', limit = 20 } = {}) {
  const lim = Number(limit) || 20;
  const q = String(location || '').trim().toLowerCase();
   const requestedCity = String(location || '').split(',')[0].trim();
  const terms = q.split(/[,\s]+/).filter(Boolean);
  const filtered = q
     ? FALLBACK_HOTELS.filter((h) => {
      const haystack = `${h.name} ${h.city} ${h.country}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    : FALLBACK_HOTELS;
 const list = filtered.length ? filtered : FALLBACK_HOTELS.map((h, i) => ({
    ...h,
    id: `${h.id}-${requestedCity || 'demo'}-${i + 1}`,
    city: requestedCity || h.city
  }));
  return list.slice(0, lim);
}

// GET /api/hotels?location=goa&checkin=2025-12-01&checkout=2025-12-05&guests=2&limit=10
router.get('/', async (req, res) => {
  try {
    if (!HOTEL_BASE || !HOTEL_KEY) {
      const location = req.query.location || req.query.city || '';
      const where = { type: 'hotel' };
      if (location) where.city = new RegExp(`^${location}$`, 'i');
      const localHotels = await Trip.find(where).select('-__v').limit(Number(req.query.limit || 20));
      if (localHotels.length) {
        return res.json({ data: localHotels, source: 'database', live: false });
      }
      return res.json({ data: getDemoHotels({ location, limit: req.query.limit }), source: 'demo', live: false, demo: true });
    }

    // Build a cache key using querystring
    const qs = new URLSearchParams(req.query).toString();
    const cacheKey = `hotels:${qs}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ data: cached, cached: true });

    // Build provider URL and request options
    const q = { ...req.query };
    // provider-specific: some APIs want different param names - adapt if needed.
    // Remove any internal-only params
    delete q._; // safety
    delete q.__;

    const url = buildProviderUrl(q);

    // Request headers: try Authorization header first (Bearer)
    const headers = {};
    if (HOTEL_KEY && !HOTEL_KEY_PARAM) {
      // prefer header auth
      headers['Authorization'] = `Bearer ${HOTEL_KEY}`;
    }

    // Fetch external API
    const providerRes = await fetch(url, { headers, timeout: 15000 });
    const providerBody = await providerRes.json().catch(() => null);

    if (!providerRes.ok) {
      // Return provider message if available
      return res.status(providerRes.status).json({ message: 'Provider error', details: providerBody || providerRes.statusText });
    }

    // Provider response shape varies; try to extract an array:
    // Common shapes: { results: [...] }, { hotels: [...] }, { data: [...] }, or root array
    let items = [];
    if (Array.isArray(providerBody)) items = providerBody;
    else if (Array.isArray(providerBody.results)) items = providerBody.results;
    else if (Array.isArray(providerBody.hotels)) items = providerBody.hotels;
    else if (Array.isArray(providerBody.data)) items = providerBody.data;
    else if (providerBody && typeof providerBody === 'object') {
      // try to find first array property
      const arrKey = Object.keys(providerBody).find(k => Array.isArray(providerBody[k]));
      items = arrKey ? providerBody[arrKey] : [];
    }

    const normalized = items.map(normalizeHotel);

    // cache and send
    cacheSet(cacheKey, normalized);
    res.json({ data: normalized, cached: false });
  } catch (err) {
    console.error('routes/hotels error:', err && err.stack ? err.stack : String(err));
     const location = req.query.location || req.query.city || '';
    res.json({ data: getDemoHotels({ location, limit: req.query.limit }), source: 'demo', live: false, demo: true });
  }
});

module.exports = router;
