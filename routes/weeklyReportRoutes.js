const express = require('express');
const {
  getAllReports,
  getReportById,
  createOrUpdateReport,
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

// Check if controllers are loaded properly
console.log('Loading weekly report routes...');
console.log('Available controllers:', Object.keys(require('../controllers/weeklyReportController')));

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
  .delete(deleteReport);

// Week routes
router.route('/:id/week/:weekNumber')
  .put(updateWeek);

// Post routes
router.route('/:id/week/:weekNumber/posts')
  .post(addPostToWeek);
// Client report routes
router.get('/client/:businessAccountId', getClientReports);
router.get('/client/:businessAccountId/statistics', getClientReportStatistics);
router.get('/client/:businessAccountId/:reportId', getClientReportById);
router.route('/:id/week/:weekNumber/posts/:postIndex')
  .put(updatePostInWeek)
  .delete(deletePostFromWeek);

module.exports = router;