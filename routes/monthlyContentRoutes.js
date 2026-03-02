// routes/monthlyContentRoutes.js
const express = require('express');
const router = express.Router();
const monthlyContentController = require('../controllers/monthlyContentController');
const authMiddleware = require('../middlewares/auth'); // Your existing middleware

// All routes are protected with your auth middleware
router.use(authMiddleware);

// =========================
// Dashboard routes
// =========================
router.get('/dashboard/summary', monthlyContentController.getDashboardSummary);
router.get('/trends', monthlyContentController.getMonthlyTrends);

// =========================
// Main CRUD routes
//==========================
router.route('/')
  .get(monthlyContentController.getAllContent)
  .post(monthlyContentController.createContent); // Add role check in controller if needed

router.route('/:id')
  .get(monthlyContentController.getContentById)
  .put(monthlyContentController.updateContent)
  .delete(monthlyContentController.deleteContent); // Add role check in controller

// =========================
// Client-specific routes
// =========================
router.get('/client/:clientId', monthlyContentController.getContentByClientId);

// =========================
// Bulk operations
// =========================
router.post('/bulk/update', monthlyContentController.bulkUpdateContent);

module.exports = router;