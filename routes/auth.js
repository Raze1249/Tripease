// routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-super-secret';

// cookie options
const cookieOpts = (req) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: !!(req.secure || req.headers['x-forwarded-proto'] === 'https'),
  maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
});

// REGISTER
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ message: 'name, email, password required' });
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: 'Email already in use' });

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, pass: hash });
  const token = jwt.sign({ uid: user._id }, JWT_SECRET, { expiresIn: '7d' });

  res.cookie('token', token, cookieOpts(req)).json({ user: { id: user._id, name: user.name, email: user.email } });
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'email and password required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid email or password' });

  const ok = await bcrypt.compare(password, user.pass);
  if (!ok) return res.status(401).json({ message: 'Invalid email or password' });

  const token = jwt.sign({ uid: user._id }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, cookieOpts(req)).json({ user: { id: user._id, name: user.name, email: user.email } });
});

// LOGOUT (clear cookie)
router.post('/logout', (req, res) => {
  res.clearCookie('token', cookieOpts(req)).json({ ok: true });
});

// ME (check session)
router.get('/me', async (req, res) => {
  const token = (req.cookies && req.cookies.token) || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(200).json({ user: null });
  try {
    const { uid } = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(uid).select('_id name email');
    res.json({ user });
  } catch {
    res.json({ user: null });
  }
});

module.exports = router;
