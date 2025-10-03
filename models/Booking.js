// models/Trip.js
const mongoose = require('mongoose');

// Define the schema for activities within the trip
const ActivitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    time: {
        type: Date,
        default: Date.now // Placeholder for activity scheduling
    }
}, { _id: false }); // Do not create separate IDs for sub-documents

// Define the main trip schema
const TripSchema = new mongoose.Schema({
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
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        // Optional, but validation ensures it's after startDate if provided
        required: false,
        validate: {
            validator: function(v) {
                // Only validate if endDate is provided
                return !v || v >= this.startDate; 
            },
            message: props => `End date (${props.value}) must be after the start date (${this.startDate}).`
        }
    },
    activities: [ActivitySchema], // Array of sub-documents using the ActivitySchema
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create and export the Mongoose model
module.exports = mongoose.model('Trip', TripSchema);
