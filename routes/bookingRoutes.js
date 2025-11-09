// routes/bookingRoutes.js
const express = require('express');
const Booking = require('../models/Booking');

const router = express.Router();

/**
 * POST /api/bookings
 * Accepts either a trip booking (tripId) or a flight booking (flight object)
 * Body:
 * {
 *   name, email, phone?, travelers?,
 *   tripId?,                  // for trip card booking
 *   flight?: { carrier, source, destination, departure, date, duration, price }, // for flight booking
 *   notes?
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { name, email } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ message: 'name and email are required' });
    }
    const doc = await Booking.create(req.body);
    res.status(201).json(doc);
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(400).json({ message: 'Failed to create booking', error: err.message });
  }
});

/**
 * GET /api/bookings
 * (Optional admin/listing)
 * Query: ?tripId=
 */
router.get('/', async (req, res) => {
  const { tripId } = req.query || {};
  const filter = {};
  if (tripId) filter.tripId = tripId;
  const items = await Booking.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(items);
});

module.exports = router;
