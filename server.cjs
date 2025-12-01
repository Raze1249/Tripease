// server.cjs - Secure backend for Tripease
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const axios = require('axios'); // For Unsplash API

// ---------- ENV CONFIG ----------
const PORT = process.env.PORT || 3000;

// Example: MONGODB_URI=mongodb+srv://.../TripeaseDB
const MONGODB_URI = process.env.MONGODB_URI;

// Example: FRONTEND_URL=https://tripease-web.onrender.com
// You can also pass multiple origins separated by commas
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = FRONTEND_URL.split(',').map((o) => o.trim());

// Unsplash access key (for /api/unsplash-image)
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Optional Aviationstack keys
const AVIATIONSTACK_API_KEY = process.env.AVIATIONSTACK_API_KEY;
const AVIATIONSTACK_URL =
  process.env.AVIATIONSTACK_URL || 'http://api.aviationstack.com/v1/airports';

if (!MONGODB_URI) {
  console.warn('⚠ MONGODB_URI is not set. Set it in .env / Render environment.');
}
if (!UNSPLASH_ACCESS_KEY) {
  console.warn('⚠ UNSPLASH_ACCESS_KEY is not set. /api/unsplash-image will not work.');
}

// ---------- INIT APP ----------
const app = express();
// Behind Render/Heroku/Nginx proxy: trust X-Forwarded-* headers
app.set('trust proxy', 1);
// Hide Express signature
app.disable('x-powered-by');

// ---------- SECURITY MIDDLEWARE ----------

// Helmet: security headers
// If CSP causes issues in dev, you can disable contentSecurityPolicy
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

// Strict CORS: only allow your frontend(s)
const allowedOrigins = FRONTEND_URL.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow no-origin (Postman, curl) or allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS: ' + origin));
    },
    credentials: true
  })
);

// Parse JSON safely
app.use(express.json({ limit: '1mb' }));
// Parse HTML form submissions (contact form, etc.)
app.use(express.urlencoded({ extended: true }));

// Parse cookies (for JWT auth)
app.use(cookieParser());

// Prevent MongoDB operator injection
app.use(
  mongoSanitize({
    replaceWith: '_'
  })
);

// Basic XSS protection (clean HTML in body/query/params)
app.use(xssClean());

// Prevent HTTP Parameter Pollution
app.use(hpp());

// ---------- RATE LIMITING ----------
// Global limiter for all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500, // 500 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', apiLimiter);

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { message: 'Too many login/register attempts, try again later.' }
});
app.use('/api/auth', authLimiter);

// ---------- DB CONNECTION ----------
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}
connectDB();

// ---------- STATIC FRONTEND ----------
// Serve your public folder (index.html, app.js, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// ---------- SIMPLE HEALTH CHECK ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ---------- ROUTES ----------

// Trips (MongoDB)
const tripRoutes = require('./routes/trips.js');
app.use('/api/trips', tripRoutes);

// Flights (mock search) – uses in-memory airport cache optionally
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// In-memory airport cache (optional)
let airportCache = [];

// Fetch airport data once (optional; safe even if it fails)
async function fetchAirportData() {
  if (!AVIATIONSTACK_API_KEY) {
    console.warn('⚠ AVIATIONSTACK_API_KEY not set, airport cache will stay empty.');
    return;
  }
  try {
    console.log('Attempting to fetch airports from Aviationstack...');
    const response = await fetch(`${AVIATIONSTACK_URL}?access_key=${AVIATIONSTACK_API_KEY}`);
    const data = await response.json();
    const validAirports = (data.data || []).filter(
      (a) => a.iata_code && a.airport_name && a.city
    );
    airportCache = validAirports.map((a) => ({
      iata: a.iata_code,
      name: a.airport_name,
      city: a.city,
      country: a.country_name
    }));
    console.log(`✅ Cached ${airportCache.length} airports.`);
  } catch (err) {
    console.error('Error fetching airport data:', err.message);
  }
}
fetchAirportData().catch(() => {});

// Airport autocomplete
app.get('/api/airports', (req, res) => {
  res.json(airportCache || []);
});

// Mock flight generator (deterministic)
function generateMockFlights(source, destination, date) {
  const flights = [];
  const carriers = ['Air Tripease', 'Global Wings', 'Oceanic Air', 'SkyPath'];

  const seed = source.length + destination.length + date.length;
  let random = (s) => {
    s = Math.sin(s++) * 10000;
    return s - Math.floor(s);
  };

  for (let i = 0; i < 5; i++) {
    const departureHour = 6 + Math.floor(random(seed + i) * 16);
    const departureMinute = Math.floor(random(seed + i + 10) * 60);
    const departureTime = `${String(departureHour).padStart(2, '0')}:${String(
      departureMinute
    ).padStart(2, '0')}`;

    const durationHours = 2 + Math.floor(random(seed + i + 20) * 8);
    const durationMinutes = Math.floor(random(seed + i + 30) * 60);
    const duration = `${durationHours}h ${durationMinutes}m`;

    const price = 100 + Math.floor(random(seed + i + 40) * 900);

    flights.push({
      id: `FLT-${Math.floor(random(seed + i + 50) * 99999)}`,
      source,
      destination,
      date,
      departure: departureTime,
      duration,
      carrier: carriers[Math.floor(random(seed + i + 60) * carriers.length)],
      price
    });
  }

  return flights;
}

// Flight search (stable mock)
app.post('/api/search-flights', (req, res) => {
  try {
    const { source, destination, departureDate } = req.body || {};

    if (!source || !destination || !departureDate) {
      return res.status(400).json({
        ok: false,
        message: 'Missing required parameters: source, destination, departureDate.'
      });
    }

    const flights = generateMockFlights(
      String(source),
      String(destination),
      String(departureDate)
    );

    return res.json({
      ok: true,
      data: flights
    });
  } catch (err) {
    console.error('search-flights error:', err);
    return res.status(500).json({
      ok: false,
      message: 'Failed to search flights on server.'
    });
  }
});

// Destinations (Amadeus + Unsplash inside router)
try {
  const destinationsRouter = require('./routes/destinations.js');
  app.use('/api/destinations', destinationsRouter);
} catch (e) {
  console.warn('Destinations route not loaded:', e.message);
}

// Hotels
try {
  const hotelsRouter = require('./routes/hotels.js');
  app.use('/api/hotels', hotelsRouter);
} catch (e) {
  console.warn('Hotels route not loaded:', e.message);
}

// Buses
try {
  const busesRouter = require('./routes/buses.js');
  app.use('/api/buses', busesRouter);
} catch (e) {
  console.warn('Buses route not loaded:', e.message);
}

// Trains
try {
  const trainsRouter = require('./routes/trains.js');
  app.use('/api/trains', trainsRouter);
} catch (e) {
  console.warn('Trains route not loaded:', e.message);
}

// Auth (login/register/logout)
try {
  const authRouter = require('./routes/auth.js');
  app.use('/api/auth', authRouter);
} catch (e) {
  console.warn('Auth route not loaded:', e.message);
}

// Bookings
try {
  const bookingsRouter = require('./routes/bookings.js');
  app.use('/api/bookings', bookingsRouter);
} catch (e) {
  console.warn('Bookings route not loaded:', e.message);
}

// Contact messages
try {
  const contactRouter = require('./routes/contact.js');
  app.use('/api/contact', contactRouter);
} catch (e) {
  console.warn('Contact route not loaded:', e.message);
}

/* ---------- Unsplash IMAGE PROXY (IMPROVED) ----------
   GET /api/unsplash-image?q=goa beach
   -> { url: "https://images.unsplash.com/..." }

   Uses:
   - Curated static images for specific destinations (Goa, Kolkata, Rajasthan, Himachal, Andaman, etc.)
   - Falls back to Unsplash search if no override matches
*/
const IMAGE_OVERRIDES = {
  kolkata: 'https://images.unsplash.com/photo-1588783216315-f46af9aa2344?auto=format&fit=crop&w=1200&q=80',
  'kolkata cultural walk': 'https://images.unsplash.com/photo-1607860108855-64b2653ef897?auto=format&fit=crop&w=1200&q=80',
  rajasthan: 'https://images.unsplash.com/photo-1524492514791-505dacd0f0a5?auto=format&fit=crop&w=1200&q=80',
  'desert camp': 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?auto=format&fit=crop&w=1200&q=80',
  goa: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80',
  'goa beach escape': 'https://images.unsplash.com/photo-1500534314211-0a24cd03f2c0?auto=format&fit=crop&w=1200&q=80',
  himachal: 'https://images.unsplash.com/photo-1477414348463-c0eb7f1359b6?auto=format&fit=crop&w=1200&q=80',
  trek: 'https://images.unsplash.com/photo-1526481280695-3c687fd543c0?auto=format&fit=crop&w=1200&q=80',
  'himalayan trek': 'https://images.unsplash.com/photo-1601758124321-4667c3c605c9?auto=format&fit=crop&w=1200&q=80',
  andaman: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80',
  'andaman island cruise': 'https://images.unsplash.com/photo-1468413253725-0d5181091126?auto=format&fit=crop&w=1200&q=80'
};

app.get('/api/unsplash-image', async (req, res) => {
  try {
    if (!UNSPLASH_ACCESS_KEY) {
      return res.status(500).json({ error: 'Unsplash key not configured' });
    }

    const qRaw = (req.query.q || 'travel destination').toString();
    const qLower = qRaw.toLowerCase();

    // 1) Check curated overrides first
    for (const key in IMAGE_OVERRIDES) {
      if (qLower.includes(key)) {
        return res.json({ url: IMAGE_OVERRIDES[key], source: 'override' });
      }
    }

    // 2) Fallback to Unsplash search
    const unsplashRes = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: qRaw,
        per_page: 1,
        orientation: 'landscape'
      },
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`
      }
    });

    const results = unsplashRes.data && unsplashRes.data.results;
    if (!results || !results.length) {
      return res.json({ url: null });
    }

    const photo = results[0];
    const url =
      photo.urls && (photo.urls.regular || photo.urls.full || photo.urls.small);

    return res.json({ url, source: 'unsplash' });
  } catch (err) {
    console.error('Unsplash API error:', err.message || err);
    res.status(500).json({ error: 'Failed to fetch from Unsplash' });
  }
});

// ---------- 404 HANDLER ----------
app.use('/api', (req, res, next) => {
  res.status(404).json({ message: 'API route not found' });
});

// ---------- GLOBAL ERROR HANDLER ----------
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong on the server.'
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
