const express = require('express');
const {
  getAllReports,
  getReportById,
  createOrUpdateReport,
  updateReportServices,  // ADD THIS - missing import
  updateWeek,
  addPostToWeek,
  updatePostInWeek,
  deletePostFromWeek,
  deleteReport,
  getReportsByBusinessAccount,
  getBusinessMonthlySummary,
  addWeek,
  getMonthlyStatistics,
  getClientReports,
  getClientReportById,
  getClientReportStatistics
} = require('../controllers/weeklyReportController');

const router = express.Router();

// Base routes
router.route('/')
  .get(getAllReports)
  .post(createOrUpdateReport);

// Business account specific routes
router.get('/business/:businessAccountId', getReportsByBusinessAccount);
router.get('/summary/business/:businessAccountId', getBusinessMonthlySummary);

// Single report routes
router.route('/:id')
  .get(getReportById)
  .put(createOrUpdateReport)  // ADD THIS - for updating entire report
  .delete(deleteReport);

// Service routes for report
router.route('/:id/services')
  .put(updateReportServices);  // ADD THIS - for updating services only

// Week routes
router.route('/:id/week/:weekNumber')
  .put(updateWeek);

// Add week route
router.route('/:id/week')
  .post(addWeek);

// Post routes
router.route('/:id/week/:weekNumber/posts')
  .post(addPostToWeek);

// Client report routes
router.get('/client/:businessAccountId', getClientReports);
router.get('/client/:businessAccountId/statistics', getClientReportStatistics);
router.get('/client/:businessAccountId/:reportId', getClientReportById);

// Single post routes (move these AFTER the specific routes to avoid conflicts)
router.route('/:id/week/:weekNumber/posts/:postIndex')
  .put(updatePostInWeek)
  .delete(deletePostFromWeek);

module.exports = router;