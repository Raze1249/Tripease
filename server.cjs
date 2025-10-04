// server.cjs

// --- 1. Dependencies ---
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// --- 2. Configuration ---

// ** CRITICAL: The MONGO_URI is now updated with your connection string! **
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://tripease_user:eb6zKS7H0bpBBC6q@cluster0.faxvovy.mongodb.net/TripeaseDB?retryWrites=true&w=majority&appName=Cluster0"; 
const PORT = process.env.PORT || 3000;

// List of allowed origins for CORS. 
const allowedOrigins = [
    // 1. Your live Render URL (for browser-based requests)
    'https://tripease-api-xu54.onrender.com', 
    
    // 2. Common local development addresses (fixes 'Failed to fetch' error)
    // If you are using a tool like VS Code Live Server, check its exact URL and add it here.
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:3000',
    'http://localhost:5173' // Common for Vite/React dev server
];

// --- 3. Express App and CORS Setup ---
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// CORS Configuration
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or file://)
        // This helps with local HTML file testing
        if (!origin) return callback(null, true); 
        
        // Check if the requesting origin is in the allowed list
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin: ' + origin;
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: 'GET,POST',
    credentials: true // Allow cookies/authorization headers if needed
}));


// --- 4. Database Connection ---
// Use the updated MONGO_URI here
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));


// --- 5. Mongoose Model Definition ---
const tripSchema = new mongoose.Schema({
    name: { type: String, required: true },
    destination: { type: String, required: true },
    startDate: { type: Date, required: true },
    source: String,
    seats: Number,
}, { timestamps: true });

const Trip = mongoose.model('Trip', tripSchema);


// --- 6. API Routes (Trips Router) ---

// Health Check / Root route
app.get('/', (req, res) => {
    res.status(200).send('Tripease API is running! Access /api/trips for data.');
});

// GET all trips
app.get('/api/trips', async (req, res) => {
    try {
        const trips = await Trip.find().sort({ createdAt: -1 }); // Sort by newest first
        res.json(trips);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch trips' });
    }
});

// POST a new trip
app.post('/api/trips', async (req, res) => {
    try {
        const { name, destination, startDate, source, seats } = req.body;
        
        // Basic Mongoose Validation Check
        if (!name || !destination || !startDate) {
            return res.status(400).json({ error: 'Missing required fields: name, destination, and startDate.' });
        }

        const newTrip = new Trip({ name, destination, startDate, source, seats });
        const savedTrip = await newTrip.save();
        res.status(201).json(savedTrip);
    } catch (err) {
        console.error('Error saving trip:', err);
        res.status(500).json({ error: 'Failed to create trip booking' });
    }
});


// --- 7. Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
