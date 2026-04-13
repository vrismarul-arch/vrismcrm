const express = require('express');
const router = express.Router();
const monthlyContentController = require('../controllers/monthlyContentController');
const authMiddleware = require('../middlewares/auth'); // Your existing middleware

// All routes are protected with your auth middleware
router.use(authMiddleware);

// =========================
// SPECIFIC ROUTES (must come BEFORE generic /:id routes)
// =========================
router.get('/weekly-summary', monthlyContentController.getWeeklySummary);
router.get('/dashboard/summary', monthlyContentController.getDashboardSummary);
router.get('/trends', monthlyContentController.getMonthlyTrends);

// =========================
// Client-specific routes
// =========================
router.get('/client/:clientId', monthlyContentController.getContentByClientId);
router.get('/client/:clientId/stats', monthlyContentController.getClientStats);

// =========================
// Bulk operations
// =========================
router.post('/bulk/update', monthlyContentController.bulkUpdateContent);

// =========================
// Weekly progress update
// =========================
router.put('/:id/weekly', monthlyContentController.updateWeeklyProgress);

// =========================
// Generic CRUD routes (must come LAST)
// =========================
router.route('/')
  .get(monthlyContentController.getAllContent)
  .post(monthlyContentController.createContent);

router.route('/:id')
  .get(monthlyContentController.getContentById)
  .put(monthlyContentController.updateContent)
  .delete(monthlyContentController.deleteContent);

module.exports = router;