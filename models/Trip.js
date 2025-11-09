const mongoose = require('mongoose');

const TripSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  imageUrl: { type: String, required: true },
  rating: { type: Number, min: 0, max: 5, default: 5 },
  description: String,
  tags: [String]
}, { timestamps: true });

module.exports = mongoose.model('Trip', TripSchema);
