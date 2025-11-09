// server.cjs — Tripease Backend (CommonJS)

const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// If using node-fetch v3 (ESM-only), use this shim.
// If you prefer, install v2: `npm i node-fetch@2` and replace with: const fetch = require('node-fetch');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// --- CONFIG (as you provided) ---
const MONGODB_URI = 'mongodb+srv://tripease_user:eb6zKS7H0bpBBC6q@cluster0.faxvovy.mongodb.net/TripeaseDB?retryWrites=true&w=majority&appName=Cluster0';
const AVIATIONSTACK_API_KEY = '7079c63c7bef98efe1dd41d3ab55c101';
const AVIATIONSTACK_URL = 'http://api.aviationstack.com/v1/airports';
const PORT = process.env.PORT || 3000;

// --- App ---
const app = express();
app.use(cors());
app.use(express.json());

// --- DB ---
(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB (TripeaseDB)');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
})();

// --- Airports cache ---
let airportCache = [];

async function fetchAirportData() {
  try {
    console.log('🌐 Fetching airports from Aviationstack...');
    const res = await fetch(`${AVIATIONSTACK_URL}?access_key=${AVIATIONSTACK_API_KEY}`);
    if (!res.ok) throw new Error(`Aviationstack API status ${res.status}`);
    const data = await res.json();

    const valid = Array.isArray(data?.data)
      ? data.data.filter(a => a.iata_code && a.airport_name && a.city)
      : [];

    airportCache = valid.map(a => ({
      iata: a.iata_code,
      name: a.airport_name,
      city: a.city,
      country: a.country_name
    }));

    console.log(`✅ Cached ${airportCache.length} airports.`);
  } catch (e) {
    console.error('⚠️ Airport fetch failed:', e.message);
    console.log('Continuing with empty airport list.');
  }
}
fetchAirportData();

// --- Mock flight search ---
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
    const departureTime = `${String(departureHour).padStart(2, '0')}:${String(departureMinute).padStart(2, '0')}`;

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

// --- Core API endpoints in this file ---
app.get('/api/airports', (req, res) => {
  res.json(airportCache);
});

app.post('/api/search-flights', (req, res) => {
  const { source, destination, departureDate } = req.body || {};
  if (!source || !destination || !departureDate) {
    return res.status(400).json({ message: 'Missing required search parameters.' });
  }
  const flights = generateMockFlights(source, destination, departureDate);
  setTimeout(() => res.json(flights), 300);
});

// --- Mount external route modules ---
// Trips (CRUD + search)
const tripRouter = require('./routes/tripRoutes'); // ensure this file exists
app.use('/api/trips', tripRouter);

// Bookings (create/list)
const bookingRouter = require('./routes/bookingRoutes'); // ensure this file exists
app.use('/api/bookings', bookingRouter);

// --- Static frontend (optional but handy) ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error('💥', err.stack || err);
  res.status(500).json({ message: 'Internal Server Error' });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
