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

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Check if MONGODB_URI is available
if (!MONGODB_URI) {
    console.error("CRITICAL ERROR: MONGODB_URI environment variable is not set.");
}

// -------------------------------------------------------------
// 3. MIDDLEWARE
// -------------------------------------------------------------

// CRITICAL CORS FIX: Allow requests from *any* origin 
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

// GET /api/trips: Fetch all booked trips (unchanged)
app.get('/api/trips', async (req, res) => {
    try {
        const trips = await Trip.find().sort({ createdAt: -1 });
        res.status(200).json(trips);
    } catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ message: 'Failed to fetch trips', error: error.message });
    }
});

// POST /api/trips: Create a new trip booking (unchanged)
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

// =================================================================
// NEW ROUTE: REAL-TIME FLIGHT SEARCH (Skyscanner Integration Point)
// =================================================================
app.post('/api/search-flights', async (req, res) => {
    // Extract parameters from the request body (sent by the frontend form)
    const { source, destination, departureDate } = req.body;
    
    if (!source || !destination || !departureDate) {
        return res.status(400).json({ message: 'Missing search parameters for flight search.' });
    }
    
    // Simulate network delay for a real API call
    await new Promise(resolve => setTimeout(resolve, 1500)); 

    /*
    * ---------------------------------------------------------
    * >> REAL SKYSCANNER INTEGRATION CODE GOES HERE <<
    * ---------------------------------------------------------
    * * 1. Retrieve the API key:
    * const apiKey = process.env.SKYSCANNER_API_KEY; 
    * * 2. Make an HTTP request to the Skyscanner API endpoint:
    * const skyscannerResponse = await fetch('SKYSCANNER_SEARCH_URL', { ... });
    * * 3. Process and return the real-time flight data.
    */

    // --- MOCK RESPONSE: Simulating real flights ---
    const mockFlights = [
        { id: 101, carrier: 'Global Air', price: 150, departure: '08:00', arrival: '11:30', duration: '3h 30m' },
        { id: 102, carrier: 'Swift Travel', price: 210, departure: '12:30', arrival: '16:00', duration: '3h 30m' },
        { id: 103, carrier: 'BudgetFly', price: 125, departure: '18:00', arrival: '21:30', duration: '3h 30m' },
    ];
    
    // Add context and simulate random price fluctuations
    const flightsWithContext = mockFlights.map(flight => ({
        ...flight,
        price: flight.price + Math.floor(Math.random() * 50) + 75, // randomize price
        destination: destination,
        source: source,
        date: departureDate
    }));
    
    res.status(200).json(flightsWithContext);
});

// -------------------------------------------------------------
// 7. START SERVER
// -------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Backend running at http://localhost:${PORT}`);
});
