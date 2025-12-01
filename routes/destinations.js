// routes/destinations.js
const router = require('express').Router();
const axios = require('axios');

/**
 * Amadeus credentials (set these in .env / Render)
 * AMADEUS_CLIENT_ID=your_client_id
 * AMADEUS_CLIENT_SECRET=your_client_secret
 * AMADEUS_ENV=TEST or LIVE (optional, default TEST)
 */
const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;
const AMADEUS_ENV = process.env.AMADEUS_ENV || 'TEST';

const AMADEUS_BASE =
  AMADEUS_ENV === 'LIVE'
    ? 'https://api.amadeus.com'
    : 'https://test.api.amadeus.com';

// in-memory token cache
let amadeusToken = null;
let amadeusTokenExpiresAt = 0; // ms timestamp

async function getAmadeusToken() {
  if (!AMADEUS_CLIENT_ID || !AMADEUS_CLIENT_SECRET) {
    throw new Error('Amadeus credentials are not configured');
  }

  const now = Date.now();
  if (amadeusToken && now < amadeusTokenExpiresAt - 60_000) {
    // reuse token, minus 60s safety margin
    return amadeusToken;
  }

  console.log('Fetching new Amadeus access token...');

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', AMADEUS_CLIENT_ID);
  params.append('client_secret', AMADEUS_CLIENT_SECRET);

  const res = await axios.post(`${AMADEUS_BASE}/v1/security/oauth2/token`, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  const data = res.data;
  amadeusToken = data.access_token;
  const expiresIn = Number(data.expires_in || 1800); // seconds
  amadeusTokenExpiresAt = now + expiresIn * 1000;

  return amadeusToken;
}

/**
 * GET /api/destinations
 * Query params:
 *  - keyword (string)
 *  - subType (CITY | AIRPORT | POINT_OF_INTEREST | NEIGHBORHOOD | ALL)
 *  - limit (1–20)
 */
router.get('/', async (req, res) => {
  try {
    let { keyword = '', subType = 'CITY', limit = '8' } = req.query;

    keyword = String(keyword || '').trim();

    // Amadeus doesn't like empty / super-long keywords -> normalise
    if (!keyword) {
      keyword = 'beach'; // safe default
    }
    if (keyword.length > 40) {
      keyword = keyword.slice(0, 40); // avoid INVALID LENGTH
    }

    // Subtype mapping – your explore.html uses these values
    const allowedSubTypes = ['CITY', 'AIRPORT', 'POINT_OF_INTEREST', 'NEIGHBORHOOD'];
    let subTypesParam;

    if (subType === 'ALL') {
      subTypesParam = allowedSubTypes.join(',');
    } else if (allowedSubTypes.includes(subType)) {
      subTypesParam = subType;
    } else {
      // fallback to CITY if unexpected
      subTypesParam = 'CITY';
    }

    // Limit: clamp between 1 and 20 (Amadeus page[limit] allowed range)
    let numLimit = parseInt(limit, 10);
    if (Number.isNaN(numLimit) || numLimit < 1) numLimit = 8;
    if (numLimit > 20) numLimit = 20;

    const token = await getAmadeusToken();

    // Amadeus "Locations" API
    const amadeusRes = await axios.get(`${AMADEUS_BASE}/v1/reference-data/locations`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        keyword,
        subType: subTypesParam,
        'page[limit]': numLimit,
        sort: 'analytics.travelers.score'
      }
    });

    const raw = Array.isArray(amadeusRes.data?.data) ? amadeusRes.data.data : [];

    // Normalise for frontend
    const cleaned = raw.map((item) => {
      const address = item.address || {};
      return {
        id: item.id,
        name: item.name || item.detailedName || '',
        subType: item.subType,
        iataCode: item.iataCode,
        geoCode: item.geoCode,
        address: {
          cityName: address.cityName,
          countryName: address.countryName
        },
        region: [address.cityName, address.countryName].filter(Boolean).join(', '),
        // description: we keep minimal; your frontend builds extra text
        description: item.detailedName || '',
        // imageUrl is handled later by /api/unsplash-image; keep null here
        imageUrl: null,
        raw: item
      };
    });

    return res.json({ data: cleaned });
  } catch (err) {
    // If error from Amadeus, log details but avoid crashing
    if (err.response) {
      console.error('Amadeus destinations HTTP error:', err.response.status, err.response.data);
    } else {
      console.error('Amadeus destinations error:', err.message || err);
    }

    // Fallback: return empty array instead of throwing 500 to frontend
    return res.status(200).json({ data: [] });
  }
});

module.exports = router;
