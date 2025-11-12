// server.cjs — Tripease (Auth + Trips + Bookings + Flights mock)
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv').config();

const MONGODB_URI = 'mongodb+srv://tripease_user:eb6zKS7H0bpBBC6q@cluster0.faxvovy.mongodb.net/TripeaseDB?retryWrites=true&w=majority&appName=Cluster0';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/contact', require('./routes/contact'));


// ---- DB ----
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(e => { console.error('Mongo error:', e.message); process.exit(1); });

// ---- Mock flights (no external API needed) ----
function mockFlights(source, destination, date) {
  const carriers = ['Air Tripease', 'Global Wings', 'Oceanic Air', 'SkyPath'];
  const seed = (source+destination+date).length;
  const rnd = n => { n = Math.sin(n) * 10000; return n - Math.floor(n); };
  return Array.from({ length: 5 }).map((_, i) => {
    const h = 6 + Math.floor(rnd(seed+i) * 16);
    const m = Math.floor(rnd(seed+i+10) * 60);
    const durH = 2 + Math.floor(rnd(seed+i+20) * 8);
    const durM = Math.floor(rnd(seed+i+30) * 60);
    const price = 100 + Math.floor(rnd(seed+i+40) * 900);
    return {
      id: `FLT-${Math.floor(rnd(seed+i+50) * 99999)}`,
      source, destination, date,
      departure: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`,
      duration: `${durH}h ${durM}m`,
      carrier: carriers[Math.floor(rnd(seed+i+60) * carriers.length)],
      price
    };
  });
}
app.post('/api/search-flights', (req, res) => {
  const { source, destination, departureDate } = req.body || {};
  if (!source || !destination || !departureDate) {
    return res.status(400).json({ message: 'source, destination, departureDate required' });
  }
  res.json(mockFlights(source, destination, departureDate));
});

// ---- Routers (make sure these files exist) ----
app.use('/api/trips', require('./routes/trips'));  // CRUD + search
app.use('/api/destinations', require('./routes/destinations'));
app.use('/api/bookings', require('./routes/bookings'));   // create/list
app.use('/api/auth', require('./routes/auth'));           // login/register/logout/me

// ---- Static frontend ----
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ---- Start ----
app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
