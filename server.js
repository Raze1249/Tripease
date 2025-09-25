# Tripease
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ DB Connection Error:", err));

// Booking model
import Booking from "./models/Booking.js";

// Routes
app.post("/api/book", async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();
    res.status(201).json({ message: "✅ Booking saved successfully!" });
  } catch (error) {
    res.status(400).json({ message: "❌ Booking failed", error });
  }
});

app.get("/api/bookings", async (req, res) => {
  const bookings = await Booking.find();
  res.json(bookings);
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
