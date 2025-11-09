const router = require('express').Router();
const Trip = require('../models/Trip');

// LIST (q, category, pagination)
router.get('/', async (req, res) => {
  const { q='', category='', page=1, limit=20, sort='-createdAt' } = req.query;
  const filter = {};
  if (q) filter.$or = [{ name: new RegExp(q,'i') }, { description: new RegExp(q,'i') }, { tags: new RegExp(q,'i') }];
  if (category) filter.category = category;

  const p = Math.max(parseInt(page)||1,1), lim = Math.min(Math.max(parseInt(limit)||20,1),100);
  const [data, total] = await Promise.all([
    Trip.find(filter).sort(sort).skip((p-1)*lim).limit(lim),
    Trip.countDocuments(filter)
  ]);
  res.json({ data, meta: { total, page:p, pages: Math.ceil(total/lim), limit: lim } });
});

// CREATE
router.post('/', async (req, res) => {
  const { name, category, imageUrl } = req.body||{};
  if (!name || !category || !imageUrl) return res.status(400).json({ message: 'name, category, imageUrl required' });
  const doc = await Trip.create(req.body);
  res.status(201).json(doc);
});

// READ
router.get('/:id', async (req, res) => {
  const doc = await Trip.findById(req.params.id);
  if (!doc) return res.status(404).json({ message:'Not found' });
  res.json(doc);
});

// UPDATE
router.put('/:id', async (req, res) => {
  const doc = await Trip.findByIdAndUpdate(req.params.id, req.body, { new:true, runValidators:true });
  if (!doc) return res.status(404).json({ message:'Not found' });
  res.json(doc);
});

// DELETE
router.delete('/:id', async (req, res) => {
  const doc = await Trip.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message:'Not found' });
  res.status(204).send();
});

module.exports = router;
