// routes/tripRoutes.js
// This file handles all API endpoints related to trips: CRUD operations.

const express = require('express');
const router = express.Router();
// -----------------------------------------------------------------------
// IMPORTANT: Adjust the path below if your model file is located elsewhere.
// We assume the model is one directory up, in the 'models' folder.
// -----------------------------------------------------------------------
const Trip = require('../models/Trip'); 

// -----------------------------------------------------------------------
// ROUTE 1: GET /api/trips
// Get all trips from the database
// -----------------------------------------------------------------------
router.get('/', async (req, res) => {
    try {
        const trips = await Trip.find();
        res.status(200).json(trips);
    } catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ 
            message: "Failed to retrieve trips",
            error: error.message 
        });
    }
});

// -----------------------------------------------------------------------
// ROUTE 2: POST /api/trips
// Create a new trip
// -----------------------------------------------------------------------
router.post('/', async (req, res) => {
    // Extract data from the request body
    const { name, destination, startDate, endDate, activities } = req.body;

    // Basic validation
    if (!name || !destination || !startDate) {
        return res.status(400).json({ message: "Missing required fields: name, destination, and startDate are needed." });
    }

    try {
        const newTrip = new Trip({
            name,
            destination,
            startDate,
            endDate,
            activities
        });

        const savedTrip = await newTrip.save();
        res.status(201).json(savedTrip); // 201 Created
    } catch (error) {
        console.error('Error creating trip:', error);
        res.status(500).json({ 
            message: "Failed to create new trip",
            error: error.message 
        });
    }
});

// -----------------------------------------------------------------------
// ROUTE 3: GET /api/trips/:id
// Get a single trip by ID
// -----------------------------------------------------------------------
router.get('/:id', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);
        if (!trip) {
            return res.status(404).json({ message: "Trip not found." });
        }
        res.status(200).json(trip);
    } catch (error) {
        console.error('Error fetching single trip:', error);
        res.status(500).json({ 
            message: "Failed to retrieve trip",
            error: error.message 
        });
    }
});

// -----------------------------------------------------------------------
// ROUTE 4: PUT /api/trips/:id
// Update an existing trip by ID
// -----------------------------------------------------------------------
router.put('/:id', async (req, res) => {
    try {
        const updatedTrip = await Trip.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true } // Return the updated document and run schema validation
        );

        if (!updatedTrip) {
            return res.status(404).json({ message: "Trip not found for update." });
        }
        res.status(200).json(updatedTrip);
    } catch (error) {
        console.error('Error updating trip:', error);
        res.status(400).json({ 
            message: "Failed to update trip",
            error: error.message 
        }); // Use 400 for validation errors
    }
});

// -----------------------------------------------------------------------
// ROUTE 5: DELETE /api/trips/:id
// Delete a trip by ID
// -----------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
    try {
        const result = await Trip.findByIdAndDelete(req.params.id);

        if (!result) {
            return res.status(404).json({ message: "Trip not found for deletion." });
        }
        // Send a 204 No Content response for successful deletion
        res.status(204).send(); 
    } catch (error) {
        console.error('Error deleting trip:', error);
        res.status(500).json({ 
            message: "Failed to delete trip",
            error: error.message 
        });
    }
});

// Export the router so it can be used in server.cjs
module.exports = router;
