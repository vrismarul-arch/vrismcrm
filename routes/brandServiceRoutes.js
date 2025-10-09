// File: routes/brandServiceRoutes.js

const express = require('express');
const router = express.Router();
const brandServiceController = require('../controllers/brandServiceController'); // updated controller

// The full path for these routes is determined by the app.use in server.js: /api/service + router path

// Get all services
// This route will handle GET requests to: /api/service
router.get('/', brandServiceController.getAllServices);

// Get one service by ID
// This route will handle GET requests to: /api/service/:id
router.get('/:id', brandServiceController.getServiceById);

// Create a new service
// This route will handle POST requests to: /api/service
router.post('/', brandServiceController.createService);

// Update a service
// This route will handle PUT requests to: /api/service/:id
router.put('/:id', brandServiceController.updateService);

// Delete a service
// This route will handle DELETE requests to: /api/service/:id
router.delete('/:id', brandServiceController.deleteService);

// Update service notes
// This route will handle PUT requests to: /api/service/:id/notes
router.put('/:id/notes', brandServiceController.updateServiceNotes);

module.exports = router;