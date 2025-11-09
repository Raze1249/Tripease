// models/Trip.js
const mongoose = require('mongoose');

// -----------------------------------------------------------------------
// 1. Activity Schema: Defines the structure for individual activities
// -----------------------------------------------------------------------
const ActivitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    // We are adding fields to match the booking data from index.html
    // These fields will be populated when a user books a flight/trip.
    source: {
        type: String,
        required: false, // Not always required if a trip is just an idea
        trim: true
    },
    carrier: {
        type: String,
        required: false,
        trim: true
    },
    price: {
        type: Number,
        required: false,
    },
    seats: {
        type: Number,
        required: false,
        min: 1
    }
}, { _id: false }); // Do not create separate IDs for sub-documents

// -----------------------------------------------------------------------
// 2. Main Trip Schema: Defines the overall structure for a single trip
// -----------------------------------------------------------------------
const TripSchema = new mongoose.Schema({
    // General Trip Details
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    destination: {
        type: String,
        required: true,
        trim: true
    },
    // The front-end is sending source and destination (Flight) info directly as trip data
    source: {
        type: String,
        required: true,
        trim: true
    },
    
    // Date & Time
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: false,
        validate: {
            validator: function(v) {
                // Ensure endDate is after startDate if provided
                return !v || v >= this.startDate; 
            },
            message: props => `End date (${props.value}) must be after the start date (${this.startDate}).`
        }
    },
    
    // Nested Documents (currently unused but ready for expansion)
    activities: [ActivitySchema], 
    
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create and export the Mongoose model
// The model name 'Trip' will result in a MongoDB collection named 'trips'.
module.exports = mongoose.model('Trip', TripSchema);
