// quotationRoutes.js
const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController'); // Ensure it's quotationController

// GET routes
router.get('/', quotationController.getAll);

// POST create a new quotation
router.post('/', quotationController.create);

// PUT update a quotation by ID
router.put('/:id', quotationController.update);

// DELETE a quotation by ID
router.delete('/:id', quotationController.remove);

// GET active businesses (for selection in quotation form, etc.)
router.get('/leads/customer', quotationController.getActiveBusinesses);

router.get('/business/:id', quotationController.getQuotationsByBusinessId);

// --- NEW FOLLOW-UP ROUTES FOR QUOTATIONS ---
// Get all follow-ups for a specific quotation
router.get('/:id/followups', quotationController.getFollowUpsByQuotationId);
// Add a new follow-up to a specific quotation
router.post('/:id/followups', quotationController.addFollowUp);
// Update a specific follow-up by its index on a quotation
router.put('/:id/followups/:index', quotationController.updateFollowUp);
// Delete a specific follow-up by its index from a quotation
router.delete('/:id/followups/:index', quotationController.deleteFollowUp);


module.exports = router;
