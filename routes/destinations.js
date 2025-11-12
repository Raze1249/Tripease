// routes/destinations.js
const router = require('express').Router();
// Use node-fetch dynamic import like in server.cjs
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const DEST_URL = process.env.TRIP_DEST_API_URL;
const DEST_KEY = process.env.TRIP_DEST_API_KEY;

// Example proxy endpoint: GET /api/destinations?limit=8&region=asia
router.get('/', async (req, res) => {
  try {
    if (!DEST_URL || !DEST_KEY) {
      return res.status(500).json({ message: 'Destination API not configured on server.' });
    }

    // Build query params to forward (you can whitelist safe params)
    const { limit = 8, region = '', q = '' } = req.query;
    const params = new URLSearchParams();
    params.append('key', DEST_KEY);
    params.append('limit', String(limit));
    if (region) params.append('region', region);
    if (q) params.append('q', q);

    const url = `${DEST_URL}?${params.toString()}`;

    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text().catch(()=>null);
      return res.status(r.status).json({ message: 'External API error', details: text });
    }

    const data = await r.json();

    // Normalize returned data to array of { name, image, description, region, rating?, id? }
    // Adapt these mapping lines to match the real API response structure.
    const items = (Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []))
      .map(d => ({
        id: d.id || d.code || d.name,
        name: d.name || d.title,
        imageUrl: (d.image && d.image.url) || d.imageUrl || d.photo || '',
        description: d.description || d.summary || '',
        region: d.region || d.country || '',
        rating: d.rating || 5
      }));

    res.json({ data: items });
  } catch (err) {
    console.error('Destinations proxy error:', err);
    res.status(500).json({ message: 'Failed to fetch destinations', error: String(err.message) });
  }
});

module.exports = router;
