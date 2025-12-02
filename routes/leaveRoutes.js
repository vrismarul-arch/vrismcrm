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

// 🟣 Leave Balance
router.get("/balance/:userId", getLeaveBalance);

// ⏳ Pending Approvals List (Filtered by role)
router.get("/pending", getPendingLeaves);

// 📌 All Leaves - View Based on Role/Team
router.get("/all", getAllLeaves);

// 🔥 Update Leave Status (Approve/Reject)
router.patch("/:id/status", updateLeaveStatus);



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


module.exports = router;
