// routes/hotels.js
const router = require('express').Router();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// env
const HOTEL_BASE = process.env.TRIP_HOTEL_API_URL; // e.g. https://api.example-hotels.com/v1/search
const HOTEL_KEY = process.env.TRIP_HOTEL_API_KEY;
const HOTEL_KEY_PARAM = process.env.TRIP_HOTEL_API_KEY_PARAM_NAME || ''; // e.g. 'api_key'
const CACHE_TTL = Number(process.env.HOTEL_CACHE_TTL_MS || (1000 * 60 * 60)); // 1h default

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

// GET /api/hotels?location=goa&checkin=2025-12-01&checkout=2025-12-05&guests=2&limit=10
router.get('/', async (req, res) => {
  try {
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
    res.status(500).json({ message: 'Failed to fetch hotels', error: String(err.message || err) });
  }
});

module.exports = router;
