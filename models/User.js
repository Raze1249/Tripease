// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, unique: true, lowercase: true },
  pass:  { type: String, required: true } // hashed
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
