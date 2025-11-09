// models/Trip.js — CommonJS model (matches tripRoutes expectations)
const mongoose = require('mongoose');

const TripSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      // tweak allowed values as you like
      enum: ['Beach', 'Mount', 'Country', 'City', 'Desert', 'Adventure', 'Cultural']
    },
    imageUrl: { type: String, required: true },
    rating: { type: Number, min: 0, max: 5, default: 5 },
    description: { type: String, default: '' },
    tags: [{ type: String, trim: true }],
    // optional extras:
    price: { type: Number, default: 0 },
    durationDays: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trip', TripSchema);
