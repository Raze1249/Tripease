// server.cjs - Backend Express Server for Tripease
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fetch = require('node-fetch'); // NOTE: Must be installed via 'npm install node-fetch'

// --- CONFIGURATION ---
// !!! IMPORTANT: YOU MUST REPLACE THIS WITH YOUR ACTUAL MONGODB CONNECTION STRING !!!
const MONGODB_URI = 'mongodb+srv://tripease_user:eb6zKS7H0bpBBC6q@cluster0.faxvovy.mongodb.net/TripeaseDB?retryWrites=true&w=majority&appName=Cluster0';
const AVIATIONSTACK_API_KEY = '7079c63c7bef98efe1dd41d3ab55c101'; 
const AVIATIONSTACK_URL = 'http://api.aviationstack.com/v1/airports';
// Use the port provided by the hosting environment (process.env.PORT) or default to 3000 for local development.
const PORT = process.env.PORT || 3000; 

// --- Initialize Express App ---
const app = express(); // <--- FIX: 'app' is now defined here.

// --- Middleware ---
// CORS configuration to allow all origins for development and deployment
app.use(cors()); 
app.use(express.json()); // Body parser for JSON requests

// --- Database Connection ---
const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB: TripeaseDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        // Exit process on failure
        process.exit(1); 
    }
};

connectDB(); // Execute the connection function

// --- Data Caching (Aviationstack Airports) ---
let airportCache = [];

// Function to fetch and cache airport data
const fetchAirportData = async () => {
    try {
        console.log('Attempting to fetch real airport data from Aviationstack...');
        const response = await fetch(`${AVIATIONSTACK_URL}?access_key=${AVIATIONSTACK_API_KEY}`);
        
        if (!response.ok) {
            throw new Error(`Aviationstack API returned status ${response.status}`);
        }
        
        const data = await response.json();
        
        // Filter for valid airports (with IATA code and name/city)
        const validAirports = data.data.filter(a => a.iata_code && a.airport_name && a.city);
        
        airportCache = validAirports.map(a => ({
            iata: a.iata_code,
            name: a.airport_name,
            city: a.city,
            country: a.country_name,
        }));

        console.log(`Successfully fetched and cached ${airportCache.length} airports.`);
    } catch (error) {
        console.error('Error fetching airport data:', error.message);
        console.log('Server will run with an empty airport list.');
    }
};

// Fetch data on startup (This can cause initial cold start latency)
fetchAirportData();


// --- Mock Flight Search Function ---
const generateMockFlights = (source, destination, date) => {
    const flights = [];
    const carriers = ["Air Tripease", "Global Wings", "Oceanic Air", "SkyPath"];

    // Use a fixed random seed based on input for repeatable results
    const seed = source.length + destination.length + date.length;
    let random = (s) => {
        s = Math.sin(s++) * 10000;
        return s - Math.floor(s);
    };

    for (let i = 0; i < 5; i++) {
        const departureHour = 6 + Math.floor(random(seed + i) * 16); // 6 AM to 10 PM
        const departureMinute = Math.floor(random(seed + i + 10) * 60);
        const departureTime = `${String(departureHour).padStart(2, '0')}:${String(departureMinute).padStart(2, '0')}`;
        
        const durationHours = 2 + Math.floor(random(seed + i + 20) * 8); // 2 to 10 hours
        const durationMinutes = Math.floor(random(seed + i + 30) * 60);
        const duration = `${durationHours}h ${durationMinutes}m`;
        
        const price = 100 + Math.floor(random(seed + i + 40) * 900); // $100 to $1000

        flights.push({
            id: `FLT-${Math.floor(random(seed + i + 50) * 99999)}`,
            source: source,
            destination: destination,
            date: date,
            departure: departureTime,
            duration: duration,
            carrier: carriers[Math.floor(random(seed + i + 60) * carriers.length)],
            price: price,
        });
    }

    return flights;
};

// --- API Endpoints (Routes) ---

// 1. Airport Autocomplete Endpoint
app.get('/api/airports', (req, res) => {
    // Returns the cached list of real airports (or empty list if fetch failed)
    res.json(airportCache); 
});

// 2. Flight Search Endpoint (Mock Data)
app.post('/api/search-flights', (req, res) => {
    const { source, destination, departureDate } = req.body;
    
    if (!source || !destination || !departureDate) {
        return res.status(400).json({ message: "Missing required search parameters." });
    }
    
    // Generate mock flight results
    const flights = generateMockFlights(source, destination, departureDate);
    
    // Simulate a network delay
    setTimeout(() => {
        res.json(flights);
    }, 500); 
});

// 3. Trip Routes (Using Mongoose for MongoDB)
// We require the Trip model here before the routes file
const tripRoutes = require('./routes/tripRoutes.js');
app.use('/api/trips', tripRoutes); // Use the dedicated router for trips

// --- Global Error Handler (Optional but Good Practice) ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke on the server!');
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running and listening on port ${PORT}`);
});
