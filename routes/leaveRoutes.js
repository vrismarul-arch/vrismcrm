const express = require("express");
const router = express.Router();

const {
  applyLeave,
  getMyLeaves,
  getLeaveBalance,
  getPendingLeaves,
  getAllLeaves,
  updateLeaveStatus
} = require("../controllers/leaveController");

// 🟢 Apply Leave
router.post("/", applyLeave);

// 📜 My Leave History
router.get("/my/:userId", getMyLeaves);

// 🟣 Balance
router.get("/balance/:userId", getLeaveBalance);

// ⏳ Pending Approvals List
router.get("/pending", getPendingLeaves);

// 📌 All Leaves - Admin / TL view
router.get("/all", getAllLeaves);

// 🔥 Update leave status (Approve/Reject)
router.patch("/:id/status", updateLeaveStatus);

module.exports = router;
