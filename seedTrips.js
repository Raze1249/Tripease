const mongoose = require("mongoose");
const Trip = require("./models/Trip");

mongoose.connect("mongodb+srv://tripease_user:pxzXeeGRDNhbgxuA@cluster0.faxvovy.mongodb.net/TripeaseDB")
  .then(async () => {

    await Trip.deleteMany(); // optional (only during development)

    await Trip.insertMany([

      // 🌍 DESTINATIONS (Explore Page)
      {
        name: "Goa Beach Escape",
        category: "Beach",
        type: "destination",
        city: "Goa",
        description: "Golden beaches, nightlife, adventure water sports.",
        rating: 5,
        imageUrl: "https://source.unsplash.com/featured/?goa",
        tags: ["beach", "nightlife"]
      },

      {
        name: "Himalayan Trek Adventure",
        category: "Mountain",
        type: "destination",
        city: "Manali",
        description: "Snow-capped mountains and scenic trekking routes.",
        rating: 5,
        imageUrl: "https://source.unsplash.com/featured/?himalaya",
        tags: ["trekking", "snow"]
      },

      // 🚆 TRAIN
      {
        name: "Rajdhani Express",
        category: "Train",
        type: "train",
        fromCity: "Delhi",
        toCity: "Mumbai",
        departureTime: "16:30",
        arrivalTime: "08:15",
        price: 2500,
        seatsAvailable: 120,
        imageUrl: "https://source.unsplash.com/featured/?train",
        rating: 4.5
      },

      // ✈️ FLIGHT
      {
        name: "IndiGo Airlines",
        category: "Flight",
        type: "flight",
        fromCity: "Delhi",
        toCity: "Goa",
        departureTime: "10:00",
        arrivalTime: "12:30",
        price: 4500,
        seatsAvailable: 60,
        imageUrl: "https://source.unsplash.com/featured/?airplane",
        rating: 4
      },

      // 🚌 BUS
      {
        name: "VRL Travels",
        category: "Bus",
        type: "bus",
        fromCity: "Pune",
        toCity: "Mumbai",
        departureTime: "07:00",
        arrivalTime: "11:00",
        price: 500,
        seatsAvailable: 30,
        imageUrl: "https://source.unsplash.com/featured/?bus",
        rating: 4
      },

      // 🏨 HOTEL
      {
        name: "Taj Palace",
        category: "Hotel",
        type: "hotel",
        city: "Delhi",
        price: 8000,
        rating: 5,
        imageUrl: "https://source.unsplash.com/featured/?hotel",
        description: "Luxury hotel in the heart of Delhi"
      }
    ]);

    console.log("✅ Trips seeded successfully!");
    process.exit();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
