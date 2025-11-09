// routes/tripRoutes.js
// CRUD + search/pagination for Trip documents (matches models/Trip.js schema)

const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip'); // <-- case-sensitive: models/Trip.js

// GET /api/trips
// Optional query params: q, category, page, limit, sort
router.get('/', async (req, res) => {
  try {
    const {
      q = '',
      category = '',
      page = 1,
      limit = 20,
      sort = '-createdAt' // e.g. 'name' or '-rating'
    } = req.query;

    const filter = {};
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
        { tags: new RegExp(q, 'i') }
      ];
    }
    if (category) filter.category = category;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const [items, total] = await Promise.all([
      Trip.find(filter).sort(sort).skip((pageNum - 1) * lim).limit(lim),
      Trip.countDocuments(filter)
    ]);

    res.status(200).json({
      data: items,
      meta: {
        total,
        page: pageNum,
        pages: Math.ceil(total / lim),
        limit: lim
      }
    });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ message: 'Failed to retrieve trips', error: error.message });
  }
});

// POST /api/trips
// Expected body: { name, category, imageUrl, rating?, description?, tags?, price?, durationDays? }
router.post('/', async (req, res) => {
  try {
    const { name, category, imageUrl } = req.body;
    if (!name || !category || !imageUrl) {
      return res.status(400).json({
        message: 'Missing required fields: name, category, and imageUrl are required.'
      });
    }

    const created = await Trip.create(req.body);
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating trip:', error);
    // 400 is appropriate for validation errors
    res.status(400).json({ message: 'Failed to create trip', error: error.message });
  }
});

// GET /api/trips/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await Trip.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Trip not found' });
    res.status(200).json(doc);
  } catch (error) {
    console.error('Error fetching trip:', error);
    res.status(400).json({ message: 'Invalid ID or failed to fetch trip', error: error.message });
  }
});

// PUT /api/trips/:id  (full update) — you can also add PATCH for partial updates
router.put('/:id', async (req, res) => {
  try {
    const updated = await Trip.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!updated) return res.status(404).json({ message: 'Trip not found for update' });
    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating trip:', error);
    res.status(400).json({ message: 'Failed to update trip', error: error.message });
  }
});

// DELETE /api/trips/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Trip.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Trip not found for deletion' });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(400).json({ message: 'Failed to delete trip', error: error.message });
  }
});

module.exports = router;
