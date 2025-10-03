// server.cjs

// ----------------------
// 1. Imports
// ----------------------
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
require('dotenv').config();

// *** CRITICAL LINE: ENSURE THIS PATH MATCHES THE FILE NAME CASE EXACTLY ***
// Assuming the file is named tripRoutes.js (camelCase) and is in the root:
const tripRoutes = require('./tripRoutes.js'); 
// If your file is TripRoutes.js (PascalCase), change the line above to:
// const tripRoutes = require('./TripRoutes.js'); 

// ----------------------
// 2. Configuration
// ----------------------
const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// ----------------------
// 3. CORS and Middleware
// ----------------------
const allowedOrigins = [
  'http://localhost:3000', 
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); 
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  }
}));

app.use(express.json());


// ----------------------
// 4. Routes
// ----------------------
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Tripease API!', status: 'Server is running' });
});

app.use('/api/trips', tripRoutes);


// ----------------------
// 5. Database Connection and Server Start
// ----------------------
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1); 
  });
