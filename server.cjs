// server.cjs

// ----------------------
// 1. Imports
// ----------------------
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
require('dotenv').config();

// CORRECTED PATH: Assumes 'tripRoutes.js' is in the root directory.
// This is the line that needs to be updated to stop looking for the 'routes' folder.
const tripRoutes = require('./tripRoutes.js'); 
// const userRoutes = require('./userRoutes.js'); // Uncomment when you create this file

// ----------------------
// 2. Configuration
// ----------------------
const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// ----------------------
// 3. CORS and Middleware
// ----------------------
// Define allowed origins for security
const allowedOrigins = [
  'http://localhost:3000', // Your local React development server
  // Add your deployed frontend URL here later
];

// Apply CORS middleware
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

// Middleware to parse incoming JSON request bodies
app.use(express.json());


// ----------------------
// 4. Routes
// ----------------------
// Base route - for testing if the server is up
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Tripease API!', status: 'Server is running' });
});

// API Routes
app.use('/api/trips', tripRoutes);
// app.use('/api/users', userRoutes); 


// ----------------------
// 5. Database Connection and Server Start
// ----------------------
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    
    // Start server ONLY after successful DB connection
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1); // Exit process if database connection fails
  });
