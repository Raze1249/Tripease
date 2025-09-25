import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  fromCity: { type: String, required: true },
  toCity: { type: String, required: true },
  travelDate: { type: Date, required: true },
  seats: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Booking", bookingSchema);

