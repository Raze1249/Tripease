// routes/explore.js
const express = require('express');
const path = require('path');
const router = express.Router();

// Models - adjust paths if your structure differs
const Trip = require('../models/Trip');           // should export a Mongoose model
const Booking = require('../models/Booking');     // should export a Mongoose model

// Serve the explore page (static HTML placed in /public)
router.get('/explore', (req, res) => {
  // If you named the file explore.htl, change file name accordingly
  res.sendFile(path.join(__dirname, '..', 'public', 'explore.html'));
});

// API: GET /api/trips
// Optional query params: q (string), mood, duration
router.get('/api/trips', async (req, res) => {
  try {
    const { q, mood, duration, limit = 50 } = req.query;
    const filter = {};

    if (mood) filter.mood = mood;
    if (duration) filter.duration = duration;

    // Basic text search across title/desc/tags if q provided
    if (q) {
      const re = new RegExp(q.trim(), 'i');
      filter.$or = [
        { title: re },
        { desc: re },
        { tags: re }
      ];
    }

    // If Trip is a Mongoose model, this should work:
    const trips = await Trip.find(filter)
      .limit(parseInt(limit, 10))
      .sort({ createdAt: -1 })
      .lean();

    // If your Trip model uses different field names, transform as needed
    res.json(trips);
  } catch (err) {
    console.error('GET /api/trips error', err);
    res.status(500).json({ message: 'Server error fetching trips' });
  }
});

// API: POST /api/book
// Accepts: { tripId, name, email, phone, travelers, notes }
// Creates a Booking document and returns booking id
router.post('/api/book', async (req, res) => {
  try {
    const { tripId, name, email, phone, travelers = 1, notes = '' } = req.body;

    if (!tripId) return res.status(400).json({ message: 'tripId required' });

    // Optionally, fetch trip details to copy price/title
    const trip = await Trip.findById(tripId).lean();
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    // Build booking payload — adapt fields to your Booking model
    const payload = {
      trip: trip._id,
      tripTitle: trip.title || '',
      tripPrice: trip.price || 0,
      name,
      email,
      phone,
      travelers,
      notes,
      status: 'pending',
      createdAt: new Date()
    };

    const booking = await Booking.create(payload);

    res.status(201).json({ message: 'Booking created', bookingId: booking._id });
  } catch (err) {
    console.error('POST /api/book error', err);
    res.status(500).json({ message: 'Server error creating booking' });
  }
});

module.exports = router;
