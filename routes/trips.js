// routes/trips.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Ensure model path matches your project structure
const Trip = require('../models/Trip');

// -----------------------
// GET /api/trips
// supports: q (search), category, sort, limit, page
// -----------------------
router.get('/', async (req, res) => {
  try {
    // Query params and defaults
    const {
      q = '',
      category = '',
      sort = '-createdAt',
      limit = 20,
      page = 1
    } = req.query;

    // Build filters
    const filters = {};

    if (category) filters.category = category;

    if (q) {
      // Escape regex special chars from user input
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(safe, 'i');
      filters.$or = [
        { name: re },
        { description: re },
        { destination: re },
        { location: re }
      ];
    }

    const perPage = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (pageNum - 1) * perPage;

    const docs = await Trip.find(filters)
      .sort(sort)
      .skip(skip)
      .limit(perPage)
      .lean();

    const total = await Trip.countDocuments(filters);

    res.json({
      data: docs,
      meta: {
        total,
        page: pageNum,
        limit: perPage,
        pages: Math.ceil(total / perPage)
      }
    });
  } catch (err) {
    console.error('Error fetching trips:', err);
    res.status(500).json({ message: 'Failed to retrieve trips', error: err.message });
  }
});
isSuggested: {
  type: Boolean,
  default: false
}
// -----------------------
// POST /api/trips
// Create new Trip
// -----------------------
router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    const trip = new Trip(payload);
    const saved = await trip.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error creating trip:', err);
    res.status(400).json({ message: 'Failed to create trip', error: err.message });
  }
});

// -----------------------
// GET /api/trips/:id
// -----------------------
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid ID' });
    const trip = await Trip.findById(id).lean();
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    console.error('Error fetching trip:', err);
    res.status(500).json({ message: 'Failed to retrieve trip', error: err.message });
  }
});

// -----------------------
// PUT /api/trips/:id
// Update trip
// -----------------------
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid ID' });
    const updated = await Trip.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: 'Trip not found' });
    res.json(updated);
  } catch (err) {
    console.error('Error updating trip:', err);
    res.status(400).json({ message: 'Failed to update trip', error: err.message });
  }
});

// -----------------------
// DELETE /api/trips/:id
// -----------------------
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid ID' });
    const deleted = await Trip.findByIdAndDelete(id).lean();
    if (!deleted) return res.status(404).json({ message: 'Trip not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting trip:', err);
    res.status(500).json({ message: 'Failed to delete trip', error: err.message });
  }
});

module.exports = router;
