// -------------------------------------------------------------
// 1. MODULE IMPORTS (CommonJS style using require)
// -------------------------------------------------------------
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // ESSENTIAL: Required for cross-origin communication

// -------------------------------------------------------------
// 2. CONFIGURATION & SETUP
// -------------------------------------------------------------
const app = express();

// Set the port from environment variables (Render) or default to 3000
const PORT = process.env.PORT || 3000;

// Use your MongoDB connection string (set as environment variable in Render for security)
// The fallback below is for local testing, but Render uses the environment variable MONGODB_URI
const MONGO_URI_FALLBACK = "mongodb+srv://tripease_user:eb6zKS7H0bpBBC6q@cluster0.faxvovy.mongodb.net/TripeaseDB?retryWrites=true&w=majority&appName=Cluster0";
const MONGODB_URI = process.env.MONGODB_URI || MONGO_URI_FALLBACK;

// -------------------------------------------------------------
// 3. MIDDLEWARE
// -------------------------------------------------------------

// CRITICAL CORS FIX: Allow requests from *any* origin (including your local file:// path)
// This is the line that fixes the "Failed to fetch" error.
app.use(cors({
    origin: '*' 
}));

// Body Parser: Allows Express to read JSON data sent in POST requests
app.use(express.json());

// -------------------------------------------------------------
// 4. DATABASE CONNECTION
// -------------------------------------------------------------
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connection successful!'))
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        // If the connection fails, log the error but allow the API to start (for debugging purposes)
    });

// -------------------------------------------------------------
// 5. MONGOOSE SCHEMA AND MODEL
// -------------------------------------------------------------
const tripSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    destination: {
        type: String,
        required: true,
        trim: true
    },
    startDate: {
        type: Date,
        required: true
    },
    source: {
        type: String,
        trim: true
    },
    seats: {
        type: Number,
        default: 1
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Trip = mongoose.model('Trip', tripSchema);

// -------------------------------------------------------------
// 6. API ROUTES
// -------------------------------------------------------------

// Root Route (Health Check)
app.get('/', (req, res) => {
    res.send('Tripease API is running!');
});

// GET /api/trips: Fetch all booked trips
app.get('/api/trips', async (req, res) => {
    try {
        const trips = await Trip.find().sort({ createdAt: -1 });
        res.status(200).json(trips);
    } catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ message: 'Failed to fetch trips', error: error.message });
    }
});

// POST /api/trips: Create a new trip booking
app.post('/api/trips', async (req, res) => {
    try {
        const newTrip = new Trip(req.body);
        const savedTrip = await newTrip.save();
        
        res.status(201).json(savedTrip);
    } catch (error) {
        console.error('Error creating trip:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation failed', errors: error.errors });
        }
        res.status(500).json({ message: 'Failed to create trip', error: error.message });
    }
});


// -------------------------------------------------------------
// 7. START SERVER
// -------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Backend running at http://localhost:${PORT}`);
});
