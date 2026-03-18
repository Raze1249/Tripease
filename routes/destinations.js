const router = require('express').Router();
const axios = require('axios');

const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

let accessToken = null;
let tokenExpiry = 0;

// 🔑 Get Amadeus token
async function getToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const res = await axios.post(
    'https://test.api.amadeus.com/v1/security/oauth2/token',
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: AMADEUS_CLIENT_ID,
      client_secret: AMADEUS_CLIENT_SECRET
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  accessToken = res.data.access_token;
  tokenExpiry = Date.now() + res.data.expires_in * 1000;

  return accessToken;
}

// 🌍 GET /api/destinations
router.get('/', async (req, res) => {
  try {
    let { keyword = 'DEL', subType = 'CITY', limit = 8 } = req.query;

    // ✅ FIX: keyword length
    keyword = keyword.trim();
    if (keyword.length < 2) keyword = 'DEL';
    if (keyword.length > 10) keyword = keyword.slice(0, 10);

    const token = await getToken();

    // 🌍 Amadeus API
    const amadeusRes = await axios.get(
      'https://test.api.amadeus.com/v1/reference-data/locations',
      {
        params: { keyword, subType },
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const data = amadeusRes.data.data || [];

    // 🖼️ Attach Unsplash images
    const results = await Promise.all(
      data.slice(0, limit).map(async (item) => {
        const name = item.name || 'destination';

        let imageUrl = '';
        try {
          const imgRes = await axios.get(
            'https://api.unsplash.com/search/photos',
            {
              params: {
                query: name,
                per_page: 1
              },
              headers: {
                Authorization: `Client-ID ${UNSPLASH_KEY}`
              }
            }
          );

          imageUrl = imgRes.data.results[0]?.urls?.regular;
        } catch {
          imageUrl =
            'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';
        }

        return {
          name: item.name,
          region: item.address?.countryName,
          imageUrl
        };
      })
    );

    res.json({ data: results });

  } catch (err) {
    console.error('DEST ERROR:', err.response?.data || err.message);
    res.status(500).json({ message: 'Failed to fetch destinations' });
  }
});

module.exports = router;
