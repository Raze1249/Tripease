const router = require('express').Router();
const Booking = require('../models/Booking');

// LIST (optional filter by tripId)
router.get('/', async (req, res) => {
  const { tripId } = req.query||{};
  const filter = tripId ? { tripId } : {};
  const data = await Booking.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(data);
});

// CREATE
router.post('/', async (req, res) => {
  const { name, email } = req.body||{};
  if (!name || !email) return res.status(400).json({ message:'name and email required' });
  const doc = await Booking.create(req.body);
  res.status(201).json(doc);
});

// READ (optional)
router.get('/:id', async (req, res) => {
  const doc = await Booking.findById(req.params.id);
  if (!doc) return res.status(404).json({ message:'Not found' });
  res.json(doc);
});

// UPDATE (optional)
router.put('/:id', async (req, res) => {
  const doc = await Booking.findByIdAndUpdate(req.params.id, req.body, { new:true, runValidators:true });
  if (!doc) return res.status(404).json({ message:'Not found' });
  res.json(doc);
});

// DELETE (optional)
router.delete('/:id', async (req, res) => {
  const doc = await Booking.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message:'Not found' });
  res.status(204).send();
});

module.exports = router;
