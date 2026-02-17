// routes/trains.js
const router = require("express").Router();
const Trip = require("../models/Trip");

// GET /trains?from=Delhi&to=Mumbai
router.get("/", async (req, res) => {
  try {
    const { from, to } = req.query;

    // basic validation
    if (!from || !to) {
      return res.status(400).json({
        message: "from and to query parameters are required"
      });
    }

    // fetch from MongoDB (NO API)
    const trains = await Trip.find({
      type: "train",
      fromCity: new RegExp(`^${from}$`, "i"),
      toCity: new RegExp(`^${to}$`, "i")
    }).select("-__v");

    res.json({
      source: "database",
      count: trains.length,
      data: trains
    });

  } catch (err) {
    console.error("Train search error:", err);
    res.status(500).json({
      message: "Failed to fetch train data"
    });
  }
});

module.exports = router;
