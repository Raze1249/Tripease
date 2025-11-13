const mongoose = require("mongoose");
const Trip = require("./models/Trip");

mongoose.connect("YOUR_MONGODB_URI").then(async () => {

  await Trip.insertMany([
    {
      name: "Goa Beach Escape",
      destination: "Goa",
      category: "Beach",
      description: "Golden beaches, nightlife, adventure water sports.",
      rating: 5,
      imageUrl: "https://source.unsplash.com/featured/?goa"
    },
    {
      name: "Himalayan Trek Adventure",
      destination: "Himalayas",
      category: "Mountain",
      description: "Snow-capped mountains and scenic trekking routes.",
      rating: 5,
      imageUrl: "https://source.unsplash.com/featured/?himalaya"
    },
    {
      name: "Rajasthan Royal Tour",
      destination: "Jaipur",
      category: "Cultural",
      description: "Fortresses, palaces, camels, and deserts.",
      rating: 4,
      imageUrl: "https://source.unsplash.com/featured/?rajasthan"
    }
  ]);

  console.log("Trips inserted!");
  process.exit();
});
