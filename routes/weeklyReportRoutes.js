const express = require("express");
const router = express.Router();
const weeklyReportController = require("../controllers/weeklyReportController");

// ✅ GET ALL REPORTS (with filtering and pagination)
router.get("/", weeklyReportController.getReports);

// ✅ CREATE REPORT
router.post("/create", weeklyReportController.createReport);

// ✅ BULK DELETE REPORTS
router.delete("/bulk-delete", weeklyReportController.bulkDeleteReports);

// ✅ GET MONTHLY SUMMARY
router.get("/monthly-summary", weeklyReportController.getMonthlySummary);
router.get("/monthly-summary/:year", weeklyReportController.getMonthlySummary);

// ✅ GET PERFORMANCE ANALYTICS
router.get("/analytics", weeklyReportController.getPerformanceAnalytics);

// ✅ GET REPORT BY CLIENT ID
router.get("/client/:id", weeklyReportController.getReportByClient);

// ✅ GET CLIENT DASHBOARD (For logged-in client)
router.get("/client-dashboard/:clientId", weeklyReportController.getClientDashboard);

// ✅ GET, UPDATE, DELETE SPECIFIC REPORT
router.get("/:id", weeklyReportController.getReportById);
router.put("/:id", weeklyReportController.updateReport);
router.delete("/:id", weeklyReportController.deleteReport);

module.exports = router;