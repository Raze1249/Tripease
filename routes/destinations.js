const router = require('express').Router();
const axios = require('axios');

const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';

const DEMO_DESTINATIONS = [
  {
    name: 'Bali',
    region: 'Indonesia',
    imageUrl:
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Swiss Alps',
    region: 'Switzerland',
    imageUrl:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Kyoto',
    region: 'Japan',
    imageUrl:
      'https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Santorini',
    region: 'Greece',
    imageUrl:
      'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Paris',
    region: 'France',
    imageUrl:
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Dubai',
    region: 'United Arab Emirates',
    imageUrl:
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'New York',
    region: 'United States',
    imageUrl:
      'https://images.unsplash.com/photo-1496588152823-e59b6d6f3f84?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Sydney',
    region: 'Australia',
    imageUrl:
      'https://images.unsplash.com/photo-1506973035872-a4ec16b8d4a7?auto=format&fit=crop&w=1200&q=80'
  }
];

let accessToken = null;
let tokenExpiry = 0;

// 🔑 Get Amadeus token
async function getToken() {
  if (!AMADEUS_CLIENT_ID || !AMADEUS_CLIENT_SECRET) return null;
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

function getDemoDestinations(limit = 8, keyword = '') {
  const safeLimit = Number(limit) || 8;
  const q = (keyword || '').trim().toLowerCase();

  if (!q) return DEMO_DESTINATIONS.slice(0, safeLimit);

  const filtered = DEMO_DESTINATIONS.filter((destination) => {
    const name = destination.name?.toLowerCase() || '';
    const region = destination.region?.toLowerCase() || '';
    return name.includes(q) || region.includes(q);
  });

  return filtered.slice(0, safeLimit);
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
     if (!token) {
     return res.json({ data: getDemoDestinations(limit, keyword), demo: true });
    }
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
           if (!UNSPLASH_KEY) throw new Error('UNSPLASH_ACCESS_KEY missing');
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
          imageUrl = FALLBACK_IMAGE;
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
   res.json({ data: getDemoDestinations(req.query.limit, req.query.keyword), demo: true });
  }
});

module.exports = router;
