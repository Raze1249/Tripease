// models/Booking.js
const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    // who is booking
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },

    travelers: { type: Number, default: 1, min: 1 },

    // optional link to a Trip card
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },

    // flight details if booking from flight search
    flight: {
      carrier: String,
      source: String,
      destination: String,
      departure: String,   // "08:30"
      date: String,        // "2025-12-01"
      duration: String,    // "6h 10m"
      price: Number
    },

    // general notes / special requests
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', BookingSchema);
