// routes/destinations.js
const router = require('express').Router();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// --- Environment variables ---
const CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;
const API_URL = process.env.TRIP_DEST_API_URL || "https://test.api.amadeus.com/v1/reference-data/locations";
const AUTH_URL = "https://test.api.amadeus.com/v1/security/oauth2/token";

// --- Cache token in memory ---
let accessToken = null;
let tokenExpiry = 0;

// --- Helper: Fetch Access Token ---
async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiry) return accessToken;

  console.log('🔐 Requesting new Amadeus access token...');
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
  if (!res.ok) throw new Error(`Amadeus Auth failed: ${JSON.stringify(data)}`);

  accessToken = data.access_token;
  tokenExpiry = now + (data.expires_in - 60) * 1000; // refresh 1 min early
  console.log('✅ Amadeus token obtained');
  return accessToken;
}

// --- GET /api/destinations?keyword=paris&subType=CITY ---
router.get('/', async (req, res) => {
  try {
    const { keyword = 'beach', subType = 'CITY', limit = 6 } = req.query;
    const token = await getAccessToken();

    const url = `${API_URL}?subType=${subType}&keyword=${encodeURIComponent(keyword)}&page[limit]=${limit}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();

    if (!r.ok) return res.status(r.status).json(data);

    const items = (data.data || []).map(d => ({
      id: d.id,
      name: d.name || d.address?.cityName || 'Unknown',
      region: d.address?.countryName || '',
      description: d.detailedName || d.subType || '',
      imageUrl: `https://source.unsplash.com/featured/?${encodeURIComponent(d.name || d.address?.cityName || 'travel')}`,
      rating: 5
    }));

    res.json({ data: items });
  } catch (err) {
    console.error('Amadeus destinations error:', err);
    res.status(500).json({ message: 'Failed to load destinations', error: err.message });
  }
});

module.exports = router;
