const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const fetch = require('node-fetch'); // This module MUST be installed via 'npm install node-fetch'
const path = require('path'); // For serving static files

const app = express();
const PORT = 3000;

// --- CONFIGURATION ---
// MongoDB CONNECTION STRING (Provided by user)
const MONGODB_URI = 'mongodb+srv://tripease_user:eb6zKS7H0bpBBC6q@cluster0.faxvovy.mongodb.net/TripeaseDB?retryWrites=true&w=majority&appName=Cluster0'; 
const DB_NAME = 'TripeaseDB'; // Using the database name specified in the URI

// --- AVIATIONSTACK CONFIG ---
// API Key provided by the user (7079c63c7bef98efe1dd41d3ab55c101)
const AVIATIONSTACK_API_KEY = '7079c63c7bef98efe1dd41d3ab55c101'; 
const AVIATIONSTACK_BASE_URL = 'http://api.aviationstack.com/v1';

// Middleware
app.use(cors());
app.use(express.json());
// Serves static files (like your index.html) from the root directory
app.use(express.static(path.join(__dirname, '')));

let db;
let airportCache = []; // Cache to store airport data from Aviationstack

// --- AIRPORT DATA FETCH & CACHING ---
async function fetchAirports() {
    console.log('Attempting to fetch real airport data from Aviationstack...');
    
    // Check if we already have data in the cache
    if (airportCache.length > 0) {
        console.log(`Using cached data: ${airportCache.length} airports.`);
        return airportCache;
    }

    // Aviationstack Endpoint: /airports
    const url = `${AVIATIONSTACK_BASE_URL}/airports?access_key=${AVIATIONSTACK_API_KEY}&limit=50`; // Fetch 50 airports
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`Aviationstack API error: Status ${response.status}`);
            const errorText = await response.text();
            console.error('Error Details:', errorText);
            throw new Error('Failed to fetch airport data from Aviationstack.');
        }

        const data = await response.json();
        
        if (data.data && Array.isArray(data.data)) {
            // Filter and map to a simpler structure (e.g., only major airports with IATA codes)
            airportCache = data.data
                .filter(a => a.iata_code && a.airport_name && a.country_name)
                .map(a => ({
                    iata: a.iata_code,
                    name: a.airport_name,
                    city: a.city_name,
                    country: a.country_name
                }));
            
            console.log(`Successfully fetched and cached ${airportCache.length} airports.`);
            return airportCache;

        } else {
            console.warn('Aviationstack response missing expected "data" array.');
            return [];
        }

    } catch (error) {
        console.error('CRITICAL: Could not connect to Aviationstack API.', error.message);
        // Fallback to empty array if API fails
        return [];
    }
}


// --- MOCK FLIGHT DATA GENERATION (Now using real IATA codes) ---
function generateMockFlights(source, destination, date) {
    // Fallback list if Aviationstack data failed to load
    const fallbackAirports = [
        { iata: 'JFK', name: 'JFK International', city: 'New York', country: 'United States' },
        { iata: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'United States' },
        { iata: 'LHR', name: 'Heathrow', city: 'London', country: 'United Kingdom' },
        { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France' },
    ];
    const airportList = airportCache.length > 0 ? airportCache : fallbackAirports;

    const numFlights = Math.floor(Math.random() * 5) + 3; // 3 to 7 flights
    const flights = [];

    // Use the first three characters of the input as the IATA code for mock flights
    const sourceIATA = source.toUpperCase().substring(0, 3);
    const destIATA = destination.toUpperCase().substring(0, 3);
    
    for (let i = 0; i < numFlights; i++) {
        const carrierOptions = ['Tripease Air', 'Global Flight Co', 'Swift Wings', 'Blue Skies'];
        const carrier = carrierOptions[Math.floor(Math.random() * carrierOptions.length)];
        const price = (Math.random() * 800 + 150).toFixed(0); // $150 to $950
        const durationHours = Math.floor(Math.random() * 10) + 2;
        const durationMinutes = Math.floor(Math.random() * 60);

        flights.push({
            id: i + 1,
            carrier: carrier,
            source: sourceIATA, 
            destination: destIATA,
            date: date,
            departure: `${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:00`,
            duration: `${durationHours}h ${durationMinutes}m`,
            price: price,
        });
    }
    return flights;
}

// --- DATABASE CONNECTION ---
async function connectToDatabase() {
    try {
        const client = await MongoClient.connect(MONGODB_URI);
        db = client.db(DB_NAME);
        console.log(`Connected to MongoDB: ${DB_NAME}`);
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        // If connection fails, db remains undefined, and API endpoints will return 503
    }
}

// --- API ROUTES ---

// Endpoint 1: Search Flights (Mock Data)
app.post('/api/search-flights', (req, res) => {
    const { source, destination, departureDate } = req.body;

    if (!source || !destination || !departureDate) {
        return res.status(400).json({ message: 'Missing required search parameters.' });
    }
    
    // Simulate API delay
    setTimeout(() => {
        const flights = generateMockFlights(source, destination, departureDate);
        res.status(200).json(flights);
    }, Math.random() * 1500 + 500); // 0.5 to 2 seconds delay
});


// Endpoint 2: Book Trip (Saves to MongoDB)
app.post('/api/trips', async (req, res) => {
    // Check if DB is connected
    if (!db) return res.status(503).json({ message: 'Database service unavailable. Check MongoDB connection.' });

    const trip = req.body;

    if (!trip.name || !trip.source || !trip.destination || !trip.startDate || !trip.seats) {
        return res.status(400).json({ message: 'Missing required trip details for booking.' });
    }

    try {
        const result = await db.collection('bookings').insertOne(trip);
        // Add the new _id to the trip object before returning
        const savedTrip = { ...trip, _id: result.insertedId }; 
        res.status(201).json(savedTrip);
    } catch (error) {
        console.error('Database insert failed:', error);
        res.status(500).json({ message: 'Internal server error during booking.' });
    }
});

// Endpoint 3: Get All Booked Trips (Reads from MongoDB)
app.get('/api/trips', async (req, res) => {
    // Check if DB is connected
    if (!db) return res.status(503).json({ message: 'Database service unavailable. Check MongoDB connection.' });
    
    try {
        // Fetch all trips, sort by creation date descending to show newest first
        const trips = await db.collection('bookings').find({}).sort({ _id: -1 }).toArray();
        res.status(200).json(trips);
    } catch (error) {
        console.error('Database fetch failed:', error);
        res.status(500).json({ message: 'Internal server error fetching trips.' });
    }
});

// Endpoint 4: Get Real Airport List (New Endpoint for Autocomplete)
app.get('/api/airports', (req, res) => {
    // This serves the cached data fetched on startup
    res.status(200).json(airportCache);
});


// --- INITIALIZATION ---
async function startServer() {
    // 1. Connect to the database
    await connectToDatabase();
    // 2. Fetch external data (Aviationstack)
    await fetchAirports(); 
    
    // 3. Start the Express server
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

startServer();
