const express = require("express");
const router = express.Router();

const {
  applyLeave,
  getMyLeaves,
  getLeaveBalance,
  getPendingLeaves,
  getAllLeaves,
  updateLeaveStatus,
  getLeaveSummary,        // NEW
  manualResetBalances     // NEW
} = require("../controllers/leaveController");

const authMiddleware = require("../middlewares/auth"); // Import if you have auth middleware

// 🟢 Apply Leave
router.post("/", applyLeave);

// 📜 My Leave History
router.get("/my/:userId", getMyLeaves);

// 🟣 Leave Balance (Updated to support year parameter)
router.get("/balance/:userId", getLeaveBalance);

// 📊 Leave Summary by Year (NEW)
router.get("/summary/:userId", getLeaveSummary);

// ⏳ Pending Approvals List (Filtered by role)
router.get("/pending", getPendingLeaves);

// 📌 All Leaves - View Based on Role/Team (Updated to support year filter)
router.get("/all", getAllLeaves);

// 🔥 Update Leave Status (Approve/Reject)
router.patch("/:id/status", updateLeaveStatus);

// 🔄 Manual Reset Balances (Admin/Superadmin only) - NEW
router.post("/balances/reset", authMiddleware, manualResetBalances);

// 🛠 One-Time Fix Route: Convert lowercase currentLevel to new correct enum
router.get("/fix/current-level", async (req, res) => {
  try {
    const Leave = require("../models/Leave");

    const convert = {
      teamLeader: "Team Leader",
      admin: "Admin",
      superadmin: "Superadmin",
    };

    const result = await Leave.updateMany(
      { currentLevel: { $in: Object.keys(convert) } },
      [
        {
          $set: {
            currentLevel: {
              $switch: {
                branches: Object.keys(convert).map(key => ({
                  case: { $eq: ["$currentLevel", key] },
                  then: convert[key]
                })),
                default: "$currentLevel"
              }
            }
          }
        }
      ]
    );

    return res.json({
      success: true,
      message: "ALL OLD RECORDS FIXED SUCCESSFULLY!",
      updated: result.modifiedCount,
    });

  } catch (err) {
    console.error("Fix error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🆕 Fix: Add leaveYear to existing leaves (One-time migration)
router.get("/fix/leave-year", async (req, res) => {
  try {
    const Leave = require("../models/Leave");
    
    const result = await Leave.updateMany(
      { leaveYear: { $exists: false } },
      [
        {
          $set: {
            leaveYear: { $year: "$fromDate" }
          }
        }
      ]
    );
    
    return res.json({
      success: true,
      message: "Leave year field added to existing records!",
      updated: result.modifiedCount,
    });
    
  } catch (err) {
    console.error("Fix error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🆕 Initialize leave balances for all users (Admin only)
router.post("/init-balances", authMiddleware, async (req, res) => {
  try {
    const User = require("../models/User");
    const LeaveBalance = require("../models/LeaveBalance");
    
    // Check if user is admin/superadmin
    const { role } = req.user || {};
    if (role !== "Admin" && role !== "Superadmin") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    const users = await User.find({});
    let created = 0;
    let existing = 0;
    
    for (const user of users) {
      const existingBalance = await LeaveBalance.findOne({ userId: user._id });
      if (!existingBalance) {
        await LeaveBalance.create({
          userId: user._id,
          balances: { Sick: 6, Casual: 12, Paid: 0, Unpaid: 0, Medical: 0 },
          currentYear: new Date().getFullYear(),
        });
        created++;
      } else {
        existing++;
      }
    }
    
    res.json({
      success: true,
      message: "Leave balances initialized!",
      created,
      existing,
      total: users.length
    });
    
  } catch (err) {
    console.error("Init error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;