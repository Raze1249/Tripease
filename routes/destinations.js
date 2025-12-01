// routes/destinations.js
const router = require('express').Router();
const axios = require('axios');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// Amadeus env
const CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;
const API_URL =
  process.env.TRIP_DEST_API_URL ||
  'https://test.api.amadeus.com/v1/reference-data/locations';
const AUTH_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';

// Unsplash env
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Simple fallback image
const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('⚠ Amadeus CLIENT_ID/CLIENT_SECRET are not set in env.');
}
if (!UNSPLASH_ACCESS_KEY) {
  console.warn('⚠ UNSPLASH_ACCESS_KEY not set, destinations will use fallback image.');
}

// --- Token cache for Amadeus ---
let accessToken = null;
let tokenExpiry = 0;

// Get Amadeus access token
async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiry) return accessToken;

  console.log('Fetching new Amadeus access token...');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  });

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error('Amadeus auth error:', data || res.statusText);
    throw new Error(`Amadeus auth failed: ${JSON.stringify(data || { status: res.status })}`);
  }

  accessToken = data.access_token;
  tokenExpiry = now + (data.expires_in - 60) * 1000; // refresh 1 min early
  return accessToken;
}

// --- Helper: Fetch an Unsplash image for a place name ---
async function getUnsplashImage(placeName, countryName) {
  if (!UNSPLASH_ACCESS_KEY) return FALLBACK_IMG;

  const query = [placeName, countryName].filter(Boolean).join(' ');
  const url =
    'https://api.unsplash.com/search/photos?' +
    new URLSearchParams({
      query: query || 'travel destination',
      per_page: '1',
      orientation: 'landscape',
      client_id: UNSPLASH_ACCESS_KEY
    }).toString();

  try {
    const res = await fetch(url, { timeout: 10000 });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data || !Array.isArray(data.results) || !data.results.length) {
      return FALLBACK_IMG;
    }

    const photo = data.results[0];
    return (photo.urls && (photo.urls.regular || photo.urls.small)) || FALLBACK_IMG;
  } catch (err) {
    console.error('Unsplash fetch error:', err && err.message ? err.message : err);
    return FALLBACK_IMG;
  }
}

// --- GET /api/destinations?keyword=paris&subType=CITY&limit=6 ---
router.get('/', async (req, res) => {
  try {
    const { keyword = 'beach', subType = 'CITY', limit = 6 } = req.query;

    const token = await getAccessToken();

    // Example Amadeus Locations endpoint:
    // GET /v1/reference-data/locations?subType=CITY&keyword=PARIS&page[limit]=5
    const url =
      `${API_URL}?subType=${encodeURIComponent(subType)}` +
      `&keyword=${encodeURIComponent(keyword)}` +
      `&page[limit]=${encodeURIComponent(limit)}`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      console.error('Amadeus destinations HTTP error:', r.status, data);
      return res.status(r.status).json({
        message: 'Amadeus destinations error',
        details: data || r.statusText
      });
    }

    const baseItems = (data && Array.isArray(data.data) ? data.data : []).map((d) => ({
      id: d.id,
      name: d.name || d.address?.cityName,
      region: d.address?.countryName || '',
      description: d.detailedName || d.subType || '',
      rating: 5,
      raw: d
    }));

    // Attach Unsplash image for each destination
    // (one Unsplash request per destination – OK for small limits like 6)
    const withImages = await Promise.all(
      baseItems.map(async (item) => {
        const imgUrl = await getUnsplashImage(item.name, item.region);
        return { ...item, imageUrl: imgUrl };
      })
    );

    return res.json({ data: withImages });
  } catch (err) {
    console.error('Destinations route error:', err && err.stack ? err.stack : String(err));
    return res.status(500).json({
      message: 'Failed to load destinations',
      error: err.message || String(err)
    });
  }
});

module.exports = router;
