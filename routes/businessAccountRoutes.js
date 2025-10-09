const express = require('express');
const router = express.Router();
const controller = require('../controllers/businessAccountController');
const User = require('../models/User'); // Assuming User model path
const Zone = require('../models/Zone'); // Assuming Zone model exists

// Route to get all users for "Assigned To" dropdown
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, 'name role');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to get quotations sent
router.get('/quotations', controller.getQuotationsSent);

// NEW ROUTE: Get paginated and filtered business accounts
router.get('/paginated', controller.getPaginatedAccounts);

// NEW ROUTE: Get aggregated counts for all account statuses
router.get('/counts', controller.getAccountCounts);

// GET all business accounts (Can be deprecated if '/paginated' is used for all list views)
router.get('/', controller.getAll);

// GET only customers (isCustomer: true)
router.get('/customers', controller.getCustomers);

// GET active leads
router.get('/leads/active', controller.getActiveLeads);

// GET leads by source type
router.get('/leads/source/:sourceType', controller.getLeadsBySource);

// CRUD operations for accounts
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete); // This is a soft delete (status to 'Closed')

// GET a business account by ID
router.get('/:id', controller.getAccountById);

// Follow-up routes
router.get('/:id/followups', controller.getFollowUpsByAccountId);
router.post('/:id/followups', controller.addFollowUp);
router.put('/:id/followups/:index', controller.updateFollowUp);
router.delete('/:id/followups/:index', controller.deleteFollowUp);

// Note routes
router.post('/:id/notes', controller.addNote);

// Placeholder for quotation specific routes if needed
router.post('/:id/quotations', controller.addQuotation); // Example for adding a quotation to an account
router.get('/:id/quotations', controller.getQuotations); // Example for getting quotations for an account

module.exports = router;