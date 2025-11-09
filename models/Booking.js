const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email:{ type: String, required: true, trim: true },
  phone: String,
  travelers: { type: Number, default: 1, min: 1 },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  flight: {
    carrier: String, source: String, destination: String,
    departure: String, date: String, duration: String, price: Number
  },
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('Booking', BookingSchema);
