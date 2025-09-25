// server.js

// ----------------------
// 1. Imports
// ----------------------
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // <--- NEW: Import CORS
require('dotenv').config();

// Import your routes
const tripRoutes = require('./routes/tripRoutes');
// const userRoutes = require('./routes/userRoutes'); // Uncomment when you add user routes

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
  'https://your-frontend-domain.com' // Replace this with your actual deployed frontend URL (e.g., Netlify/Vercel)
];

// Apply CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true); 
    // Allow the specified origins
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  }
}));

// Built-in middleware for handling JSON data
app.use(express.json());


// ----------------------
// 4. Routes
// ----------------------
// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Tripease API!', status: 'Server is running' });
});

// API Routes
app.use('/api/trips', tripRoutes);
// app.use('/api/users', userRoutes); // Uncomment when ready

// ----------------------
// 5. Database Connection and Server Start
// ----------------------
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    
    // Start server ONLY after successful DB connection
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port http://localhost:${PORT}`);
      console.log(`Render URL: ${process.env.RENDER_EXTERNAL_URL || 'N/A'}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1); // Exit process if database connection fails
  });
