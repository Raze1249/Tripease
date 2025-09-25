// server.js

// 1. Core Imports (ESM Syntax)
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';

// 2. Import Route Files (You will create these later)
// import tripRoutes from './routes/tripRoutes.js';
// import userRoutes from './routes/userRoutes.js';

// Load environment variables from .env file
dotenv.config();

// 3. Setup Constants
const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// 4. Middleware
// Enable CORS for all routes
app.use(cors()); 

// Body parser for JSON data
app.use(express.json()); 

// 5. Database Connection
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    // Exit process with failure code if DB connection fails
    process.exit(1); 
  });

// 6. Basic Route (Health Check)
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Welcome to the Tripease API!', 
    status: 'Server is running' 
  });
});

// 7. Route Handlers (Uncomment and implement when ready)
// app.use('/api/trips', tripRoutes);
// app.use('/api/users', userRoutes);

// 8. Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something broke!',
    error: err.message
  });
});


// 9. Start the Server
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
