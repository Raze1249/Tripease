// routes/destinations.js
const router = require('express').Router();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// --- Env ---
// Make sure you set these in your .env or Render env vars:
const CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;
const API_URL = process.env.TRIP_DEST_API_URL || "https://test.api.amadeus.com/v1/reference-data/locations";
const AUTH_URL = "https://test.api.amadeus.com/v1/security/oauth2/token";

// --- Token cache ---
let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiry) return accessToken;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET must be set in environment');
  }

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
  if (!res.ok) {
    const msg = typeof data === 'object' ? JSON.stringify(data) : String(data);
    throw new Error(`Amadeus Auth failed: ${msg}`);
  }

  accessToken = data.access_token;
  tokenExpiry = now + (Number(data.expires_in || 1800) - 60) * 1000; // refresh 1 min early
  return accessToken;
}

// Unsplash Source helper to return a query-based image URL.
// Using the place name ensures different queries => usually different images.
// We include a fixed size for more consistent images.
function unsplashFor(query) {
  // sanitize query
  const q = encodeURIComponent(query || 'travel');
  // Use size to vary results and improve layout; example 1200x800
  return `https://source.unsplash.com/1200x800/?${q}`;
}

// --- GET /api/destinations?keyword=paris&subType=CITY&limit=6 ---
router.get('/', async (req, res) => {
  try {
    const { keyword = '', subType = 'CITY', limit = 6 } = req.query;

    // get token
    const token = await getAccessToken();

    // build Amadeus request (adapt params as needed)
    const url = `${API_URL}?subType=${encodeURIComponent(subType)}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}&page[limit]=${encodeURIComponent(limit)}`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!r.ok) {
      const txt = await r.text().catch(()=>null);
      return res.status(r.status).json({ message: 'Amadeus API error', details: txt || 'no details' });
    }

    const data = await r.json();

    // Map results and create an image URL per item using the name (or other available fields).
    const items = (data.data || []).map(d => {
      // Choose the best text label available for the place
      const placeName = d.name || d.detailedName || d.address?.cityName || d.address?.countryName || (d.subType ? d.subType : '');
      // If placeName is empty, fall back to 'travel' so Unsplash returns a generic travel image.
      const imageUrl = unsplashFor(placeName || 'travel');

      return {
        id: d.id || (d.self && d.self.split('/').pop()) || placeName,
        name: placeName || 'Unknown',
        region: d.address?.countryName || '',
        description: d.detailedName || d.subType || '',
        imageUrl,
        rating: 5
      };
    });

    res.json({ data: items });
  } catch (err) {
    console.error('Amadeus destinations error:', err && err.stack ? err.stack : String(err));
    res.status(500).json({ message: 'Failed to load destinations', error: String(err.message || err) });
  }
});

module.exports = router;
