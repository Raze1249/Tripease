// routes/contact.js
const router = require('express').Router();
const ContactMessage = require('../models/ContactMessage');

// POST /api/contact  (public)
router.post('/', async (req, res) => {
  try {
    const { name, email, subject = '', message } = req.body || {};
    if (!name || !email || !message) return res.status(400).json({ message: 'name, email, message are required' });

    const doc = await ContactMessage.create({
      name, email, subject, message,
      ip: req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || '',
      ua: req.headers['user-agent'] || ''
    });

    res.status(201).json({ ok: true, id: doc._id });
  } catch (e) {
    console.error('Contact save error:', e);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// GET /api/contact  (optional: basic listing)
router.get('/', async (_req, res) => {
  const items = await ContactMessage.find().sort({ createdAt: -1 }).limit(200);
  res.json(items);
});

module.exports = router;
