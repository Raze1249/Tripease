// models/Trip.js
const mongoose = require('mongoose');

// Define the Trip schema
const TripSchema = new mongoose.Schema(
  {
    // Trip name (example: "Bali Beach Paradise")
    name: {
      type: String,
      required: true,
      trim: true
    },

    // Trip category (you can customize the options as needed)
    category: {
      type: String,
      enum: ['Beach', 'Mount', 'Country', 'City', 'Desert', 'Adventure', 'Cultural'],
      required: true
    },

    // Main image URL for the trip
    imageUrl: {
      type: String,
      required: true
    },

    // Trip rating (default 5)
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 5
    },

    // Description of the trip
    description: {
      type: String,
      default: ''
    },

    // Optional tags (for filtering)
    tags: [
      {
        type: String,
        trim: true
      }
    ],

    // Optional price field (in USD)
    price: {
      type: Number,
      default: 0
    },

    // Optional duration in days
    durationDays: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true // automatically adds createdAt and updatedAt
  }
);

// Export the model
module.exports = mongoose.model('Trip', TripSchema);
