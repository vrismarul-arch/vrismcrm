const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const dayjs = require("dayjs");

// 🟢 Apply Leave
exports.applyLeave = async (req, res) => {
  try {
    const { userId, type, fromDate, toDate, reason } = req.body;
    const diffDays = dayjs(toDate).diff(dayjs(fromDate), "day") + 1;

    let balance = await LeaveBalance.findOne({ userId });
    if (!balance) balance = await LeaveBalance.create({ userId });

    if (balance.balances[type] !== Infinity &&
        balance.balances[type] < diffDays) {
      return res.status(400).json({
        message: `Not enough ${type} leave balance. Remaining: ${balance.balances[type]}`,
      });
    }

    const leave = await Leave.create({ userId, type, fromDate, toDate, reason });
    res.status(201).json({ message: "Leave applied successfully", leave });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// 🟡 Get My Leave History
exports.getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.status(200).json({ leaves });
  } catch {
    res.status(500).json({ message: "Failed to fetch user leave history" });
  }
};


// 🔴 Pending Approvals (Role based)
exports.getPendingLeaves = async (req, res) => {
  try {
    const { role } = req.query;
    let filter = { status: "Pending" };

    if (role === "Team Leader") {
      filter.currentLevel = "teamLeader";
    } else if (role === "Admin") {
      filter.currentLevel = "admin";
    } else if (role === "Superadmin") {
      filter.currentLevel = "superadmin";
    }

    const pending = await Leave.find(filter)
      .populate("userId", "name email role team")
      .sort({ createdAt: -1 });

    res.status(200).json({ pending });

  } catch {
    res.status(500).json({ message: "Failed to load pending leaves" });
  }
};


// 🔵 Admin / TL leave history view (role filtering)
exports.getAllLeaves = async (req, res) => {
  try {
    const { role, userId, teamId } = req.query;
    let filter = {};

    if (role === "Employee") {
      filter.userId = userId;
    } else if (role === "Team Leader") {
      filter["userId.team"] = teamId;
    }

    const leaves = await Leave.find(filter)
      .populate("userId", "name role team")
      .sort({ createdAt: -1 });

    const balances = await LeaveBalance.find();

    const formatted = leaves.map((l) => {
      const bal = balances.find((b) => b.userId.toString() === l.userId._id.toString());
      return {
        ...l._doc,
        leaveBalance: bal?.balances || {}
      };
    });

    res.status(200).json(formatted);

  } catch {
    res.status(500).json({ message: "Failed to fetch leave history" });
  }
};


// 🟣 Leave Balance API
exports.getLeaveBalance = async (req, res) => {
  try {
    const bal = await LeaveBalance.findOne({ userId: req.params.userId });
    res.status(200).json(bal?.balances || {});
  } catch {
    res.status(500).json({ message: "Failed to fetch leave balance" });
  }
};


// 🔥 Update Status with Reason + Level Approval
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { role, status, rejectReason } = req.body;
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Not found" });

    const diffDays = dayjs(leave.toDate).diff(dayjs(leave.fromDate), "day") + 1;

    // ❌ Reject logic with reason
    if (status === "Rejected") {
      leave.currentLevel = "completed";
      leave.status = "Rejected";
      leave.rejectReason = rejectReason || "Not Provided";

      if (role === "Team Leader") leave.approval.teamLeader = "Rejected";
      if (role === "Admin") leave.approval.admin = "Rejected";
      if (role === "Superadmin") leave.approval.superadmin = "Rejected";
    }

    // ✅ Approvals Level wise
    if (status === "Approved") {
      if (role === "Team Leader") {
        leave.approval.teamLeader = "Approved";
        leave.currentLevel = "admin";
      }

      if (role === "Admin") {
        leave.approval.admin = "Approved";
        leave.currentLevel = "superadmin";
      }

      if (role === "Superadmin") {
        leave.approval.superadmin = "Approved";
        leave.status = "Approved";
        leave.currentLevel = "completed";

        // Deduct leave balance only after final approval
        let balance = await LeaveBalance.findOne({ userId: leave.userId });
        if (balance.balances[leave.type] !== Infinity) {
          balance.balances[leave.type] -= diffDays;
          await balance.save();
        }
      }
    }

    await leave.save();
    res.status(200).json({ message: `Leave ${status}`, leave });

  } catch (err) {
    res.status(500).json({ message: "Status update failed", error: err.message });
  }
};
