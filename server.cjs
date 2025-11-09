// server.cjs — Tripease Backend (CommonJS)

const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// If using node-fetch v3 (ESM-only), use this import shim:
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// --- CONFIGURATION ---
const MONGODB_URI = 'mongodb+srv://tripease_user:eb6zKS7H0bpBBC6q@cluster0.faxvovy.mongodb.net/TripeaseDB?retryWrites=true&w=majority&appName=Cluster0';
const AVIATIONSTACK_API_KEY = '7079c63c7bef98efe1dd41d3ab55c101';
const AVIATIONSTACK_URL = 'http://api.aviationstack.com/v1/airports';
const PORT = process.env.PORT || 3000;

// --- Initialize Express App ---
const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Connect to MongoDB ---
(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB (TripeaseDB)');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
})();

// --- Airport Data Cache ---
let airportCache = [];

const fetchAirportData = async () => {
  try {
    console.log('🌐 Fetching airport data from Aviationstack...');
    const response = await fetch(`${AVIATIONSTACK_URL}?access_key=${AVIATIONSTACK_API_KEY}`);

    if (!response.ok) {
      throw new Error(`Aviationstack API returned status ${response.status}`);
    }

    const data = await response.json();
    const validAirports = Array.isArray(data?.data)
      ? data.data.filter(a => a.iata_code && a.airport_name && a.city)
      : [];

    airportCache = validAirports.map(a => ({
      iata: a.iata_code,
      name: a.airport_name,
      city: a.city,
      country: a.country_name,
    }));

    console.log(`✅ Cached ${airportCache.length} airports.`);
  } catch (error) {
    console.error('⚠️ Error fetching airport data:', error.message);
    console.log('Server running with empty airport list.');
  }
};

fetchAirportData();

// --- Generate Mock Flights ---
const generateMockFlights = (source, destination, date) => {
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
      price,
    });
  }

  return flights;
};

// --- API ENDPOINTS ---

// ✅ 1. Get Cached Airports
app.get('/api/airports', (req, res) => {
  res.json(airportCache);
});

// ✅ 2. Mock Flight Search
app.post('/api/search-flights', (req, res) => {
  const { source, destination, departureDate } = req.body;

  if (!source || !destination || !departureDate) {
    return res.status(400).json({ message: 'Missing required search parameters.' });
  }

  const flights = generateMockFlights(source, destination, departureDate);
  setTimeout(() => res.json(flights), 300);
});

// ✅ 3. Trip Routes (connects to MongoDB)
const tripRouter = require('./routes/tripRoute'); // Ensure file exists & path matches
app.use('/api/trips', tripRouter);

// ✅ 4. Serve Static Frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error('💥 Error:', err.stack || err);
  res.status(500).json({ message: 'Internal Server Error' });
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
