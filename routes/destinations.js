// routes/destinations.js
const router = require('express').Router();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// Environment (ensure these are set in .env and on Render)
const CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;
const API_URL = process.env.TRIP_DEST_API_URL || "https://test.api.amadeus.com/v1/reference-data/locations";
const AUTH_URL = "https://test.api.amadeus.com/v1/security/oauth2/token";
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Basic safety checks
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('Warning: AMADEUS_CLIENT_ID or AMADEUS_CLIENT_SECRET not set. Amadeus requests will fail until provided.');
}
if (!UNSPLASH_KEY) {
  console.warn('Warning: UNSPLASH_ACCESS_KEY not set. Unsplash image lookups will fall back to source.unsplash.com.');
}

// --- Token cache for Amadeus ---
let accessToken = null;
let tokenExpiry = 0;
async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiry) return accessToken;

  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET are required');

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  });

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Amadeus auth failed: ${JSON.stringify(data)}`);

  accessToken = data.access_token;
  tokenExpiry = now + (Number(data.expires_in || 1800) - 60) * 1000; // refresh 1 min early
  return accessToken;
}

// --- Simple in-memory caches ---
// cacheDestinations: caches Amadeus results per query keyword (TTL ms)
// cacheImages: caches Unsplash image URLs per placeName (TTL ms)
const cacheDestinations = new Map();
const cacheImages = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours by default (adjustable)

// Helper: set/get cache with TTL
function cacheSet(map, key, value) {
  map.set(key, { value, ts: Date.now() });
}
function cacheGet(map, key, ttl = CACHE_TTL_MS) {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) {
    map.delete(key);
    return null;
  }
  return entry.value;
}

// Helper: fallback unsplash source URL (no API key required)
function unsplashSource(query) {
  const q = encodeURIComponent(query || 'travel');
  return `https://source.unsplash.com/1200x800/?${q}`;
}

// Helper: call Unsplash Search Photos and return first photo URL or null
async function fetchUnsplashImage(placeName) {
  if (!placeName) return null;

  // check cache first
  const cached = cacheGet(cacheImages, placeName);
  if (cached) return cached;

  // If no API key, fall back to Unsplash Source
  if (!UNSPLASH_KEY) {
    const src = unsplashSource(placeName);
    cacheSet(cacheImages, placeName, src);
    return src;
  }

  // Build search endpoint
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(placeName)}&per_page=1`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_KEY}`,
        'Accept-Version': 'v1'
      }
    });

    // Rate-limit / error handling: if not ok, fallback
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn(`Unsplash search failed for "${placeName}" status=${res.status} body=${txt}`);
      const src = unsplashSource(placeName);
      cacheSet(cacheImages, placeName, src);
      return src;
    }

    const body = await res.json();
    const first = Array.isArray(body.results) && body.results[0];
    const imageUrl = first?.urls?.regular || first?.urls?.small || first?.links?.html || null;

    if (imageUrl) {
      cacheSet(cacheImages, placeName, imageUrl);
      return imageUrl;
    }

    // fallback to source
    const src = unsplashSource(placeName);
    cacheSet(cacheImages, placeName, src);
    return src;

  } catch (err) {
    console.error('Unsplash fetch error:', err && err.stack ? err.stack : String(err));
    const src = unsplashSource(placeName);
    cacheSet(cacheImages, placeName, src);
    return src;
  }
}

// Utility: get best textual label for a destination from Amadeus item
function extractPlaceName(item) {
  return item.name || item.detailedName || item.address?.cityName || item.address?.countryName || item.subType || '';
}

// GET /api/destinations?keyword=paris&subType=CITY&limit=6
router.get('/', async (req, res) => {
  try {
    const { keyword = '', subType = 'CITY', limit = 6 } = req.query;
    const cacheKey = `kw:${keyword}|sub:${subType}|lim:${limit}`;

    // If cached Amadeus result exists, return cached (but still ensure images present)
    const cached = cacheGet(cacheDestinations, cacheKey);
    if (cached) {
      return res.json({ data: cached });
    }

    // Authenticate with Amadeus (get access token)
    const token = await getAccessToken();

    // Build Amadeus URL
    const url = `${API_URL}?subType=${encodeURIComponent(subType)}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}&page[limit]=${encodeURIComponent(limit)}`;

    const amRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const amBody = await amRes.json().catch(() => null);
    if (!amRes.ok) {
      const msg = amBody || `status ${amRes.status}`;
      return res.status(amRes.status).json({ message: 'Amadeus API error', details: msg });
    }

    const itemsRaw = Array.isArray(amBody?.data) ? amBody.data : [];

    // For each item, determine placeName and fetch unsplash image (with cache)
    // We'll do these lookups in parallel but limit concurrency if needed
    // Simple parallel (Promise.all); if you need throttling use p-limit or a queue.
    const enhanced = await Promise.all(itemsRaw.map(async (d) => {
      const placeName = extractPlaceName(d) || (d.id || '').toString();
      const imageUrl = await fetchUnsplashImage(placeName);
      return {
        id: d.id || placeName,
        name: placeName || 'Unknown',
        region: d.address?.countryName || '',
        description: d.detailedName || d.subType || '',
        imageUrl,
        rating: 5,
        raw: d // optionally include raw Amadeus payload for debugging
      };
    }));

    // Cache result set (store only the enhanced metadata)
    cacheSet(cacheDestinations, cacheKey, enhanced);

    res.json({ data: enhanced });
  } catch (err) {
    console.error('Destinations route error:', err && err.stack ? err.stack : String(err));
    res.status(500).json({ message: 'Failed to load destinations', error: String(err.message || err) });
  }
});

module.exports = router;
