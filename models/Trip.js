const mongoose = require('mongoose');

const TripSchema = new mongoose.Schema({
  // 🔹 Common fields (already yours)
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true }, 
  imageUrl: { type: String, required: true }, // city image (API)
  rating: { type: Number, min: 0, max: 5, default: 5 },
  description: String,
  tags: [String],

  // 🔹 NEW: booking-related fields
  type: {
    type: String,
    enum: ["train", "flight", "bus", "hotel"],
    required: true
  },

  fromCity: String,
  toCity: String,
  city: String, // for hotels

  departureTime: String,
  arrivalTime: String,

  price: Number,
  seatsAvailable: Number
}, { timestamps: true });

module.exports = mongoose.model('Trip', TripSchema);
