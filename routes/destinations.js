// routes/destinations.js
const router = require("express").Router();
const Trip = require("../models/Trip");

// GET /api/destinations?keyword=goa&limit=8
router.get("/", async (req, res) => {
  try {
    const { keyword = "", limit = 8 } = req.query;

    const query = {
      type: "destination"
    };

    // keyword search (name / city / category)
    if (keyword) {
      query.$or = [
        { name: new RegExp(keyword, "i") },
        { city: new RegExp(keyword, "i") },
        { category: new RegExp(keyword, "i") },
        { tags: new RegExp(keyword, "i") }
      ];
    }

    const destinations = await Trip.find(query)
      .limit(Number(limit))
      .select("name description imageUrl rating city category");

    res.json({
      source: "database",
      data: destinations
    });

  } catch (err) {
    console.error("destinations error:", err);
    res.status(500).json({
      message: "Failed to fetch destinations"
    });
  }
});

module.exports = router;
