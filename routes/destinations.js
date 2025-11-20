// routes/destinations.js
const router = require('express').Router();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// Env
const CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;
const API_URL = process.env.TRIP_DEST_API_URL || 'https://test.api.amadeus.com/v1/reference-data/locations';
const AUTH_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('⚠ Amadeus CLIENT_ID/CLIENT_SECRET are not set in env.');
}

// Token cache
let accessToken = null;
let tokenExpiry = 0;

// --- Helper: Get Amadeus Access Token ---
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

// --- GET /api/destinations?keyword=paris&subType=CITY ---
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
      // Pass through status so frontend can decide fallback
      return res.status(r.status).json({
        message: 'Amadeus destinations error',
        details: data || r.statusText
      });
    }

    const items = (data && Array.isArray(data.data) ? data.data : []).map((d) => ({
      id: d.id,
      name: d.name || d.address?.cityName,
      region: d.address?.countryName || '',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      description: d.detailedName || d.subType || '',
      rating: 5,
      raw: d
    }));

    return res.json({ data: items });
  } catch (err) {
    console.error('Destinations route error:', err && err.stack ? err.stack : String(err));
    // If Amadeus throws 38189 or similar, we still just return 500 to the frontend
    return res.status(500).json({
      message: 'Failed to load destinations',
      error: err.message || String(err)
    });
  }
});

module.exports = router;
