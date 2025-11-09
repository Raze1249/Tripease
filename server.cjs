const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const MONGODB_URI = 'mongodb+srv://tripease_user:eb6zKS7H0bpBBC6q@cluster0.faxvovy.mongodb.net/TripeaseDB?retryWrites=true&w=majority&appName=Cluster0';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// routers
app.use('/api/trips', require('./routes/trips'));
app.use('/api/bookings', require('./routes/bookings'));

// static (optional)
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(MONGODB_URI).then(() => {
  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
}).catch(err => {
  console.error('Mongo connect error:', err.message);
  process.exit(1);
});
