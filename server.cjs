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

// ---------- ENV CONFIG ----------
const PORT = process.env.PORT || 3000;

// DO NOT hard-code this; set in .env and in Render
// Example: MONGODB_URI=mongodb+srv://.../TripeaseDB
const MONGODB_URI = process.env.MONGODB_URI;

// Example: FRONTEND_URL=https://tripease-web.onrender.com
// You can also pass multiple origins separated by commas
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Amadeus / Unsplash keys are already used inside routes (destinations.js, hotels.js, etc.)

if (!MONGODB_URI) {
  console.warn('⚠ MONGODB_URI is not set. Set it in .env / Render environment.');
}

// ---------- INIT APP ----------
const app = express();

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

// Parse cookies (for JWT auth)
app.use(cookieParser());

// Prevent MongoDB operator injection (& etc in query/body)
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
// Global limiter for all API routes (you can tune this)
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
/**
 * IMPORTANT:
 * Only require routes that actually exist in your repo.
 * If you haven't created some of these yet, comment them out.
 */

// Trips (MongoDB)
const tripRoutes = require('./routes/trips.js');
app.use('/api/trips', tripRoutes);

// Flights (mock search) – kept here if you still use it
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const AVIATIONSTACK_API_KEY = process.env.AVIATIONSTACK_API_KEY; // optional now
const AVIATIONSTACK_URL =
  process.env.AVIATIONSTACK_URL || 'http://api.aviationstack.com/v1/airports';

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

// Mock flight generator (same as before)
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

// Flight search
app.post('/api/search-flights', (req, res) => {
  const { source, destination, departureDate } = req.body || {};
  if (!source || !destination || !departureDate) {
    return res
      .status(400)
      .json({ message: 'Missing required parameters: source, destination, departureDate.' });
  }
  const flights = generateMockFlights(source, destination, departureDate);
  res.json(flights);
});

// Destinations (Amadeus + Unsplash)
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

// ---------- 404 HANDLER ----------
app.use('/api', (req, res, next) => {
  res.status(404).json({ message: 'API route not found' });
});

// ---------- GLOBAL ERROR HANDLER ----------
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong on the server.',
    // In production you might hide stack:
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
