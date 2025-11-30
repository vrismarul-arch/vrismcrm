const express = require("express");
const router = express.Router();
const {
  startWorkSession,
  stopWorkSession,
  addEod,
  getTodaysSession,
  getAllTodaysSessions,getMonthlyAttendance,
  getSessionsByDateRange,
} = require("../controllers/workSessionController");

router.post("/start", startWorkSession);
router.post("/stop", stopWorkSession);
router.post("/eod", addEod);
router.get("/today/:userId", getTodaysSession);
router.get("/today", getAllTodaysSessions);
router.get("/range", getSessionsByDateRange); // ✅ new route for all history
router.get("/attendance", getMonthlyAttendance);

module.exports = router;
