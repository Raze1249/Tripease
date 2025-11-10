// models/ContactMessage.js
const mongoose = require('mongoose');

const ContactMessageSchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true },
  email:  { type: String, required: true, trim: true, lowercase: true },
  subject:{ type: String, trim: true },
  message:{ type: String, required: true, trim: true },
  ip:     { type: String, default: '' },
  ua:     { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('ContactMessage', ContactMessageSchema);
