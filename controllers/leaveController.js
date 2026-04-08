// controllers/leaveController.js (Complete updated version)
const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const User = require("../models/User");
const { sendAlert } = require("./alertController");
const dayjs = require("dayjs");

const fmt = (d) => dayjs(d).format("DD MMM YYYY");

// Helper: Get current balance with auto-reset
const getCurrentBalance = async (userId) => {
  let balance = await LeaveBalance.findOne({ userId });
  
  if (!balance) {
    balance = await LeaveBalance.create({ 
      userId,
      currentYear: new Date().getFullYear()
    });
  }
  
  if (balance.needsReset()) {
    await balance.resetForNewYear();
    balance = await LeaveBalance.findOne({ userId });
  }
  
  return balance;
};

// 🟢 APPLY LEAVE
exports.applyLeave = async (req, res) => {
  try {
    const { userId, type, fromDate, toDate, reason } = req.body;
    
    const fromYear = dayjs(fromDate).year();
    const toYear = dayjs(toDate).year();
    
    if (fromYear !== toYear) {
      return res.status(400).json({ 
        message: "Leave cannot span across different years. Please apply separately for each year." 
      });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const diff = dayjs(toDate).diff(dayjs(fromDate), "day") + 1;
    const balance = await getCurrentBalance(userId);

    if (balance.balances[type] !== Infinity && balance.balances[type] < diff) {
      return res.status(400).json({ 
        message: `Not enough balance. Available: ${balance.balances[type]}, Required: ${diff}` 
      });
    }

    // Check for overlapping leaves
    const overlappingLeave = await Leave.findOne({
      userId,
      status: { $ne: "Rejected" },
      leaveYear: fromYear,
      $or: [
        { fromDate: { $lte: toDate }, toDate: { $gte: fromDate } }
      ]
    });
    
    if (overlappingLeave) {
      return res.status(400).json({ 
        message: "You already have a leave request in this period" 
      });
    }

    const leave = await Leave.create({
      userId,
      type,
      fromDate,
      toDate,
      reason,
      status: "Pending",
      currentLevel: "Team Leader",
      leaveYear: fromYear,
    });

    const TL = await User.findOne({ team: user.team, role: "Team Leader" });

    await sendAlert({
      userId,
      message: `Leave Requested (${fmt(fromDate)} - ${fmt(toDate)})`,
      type: "Leave",
      refId: leave._id,
    });

    if (TL && TL._id.toString() !== userId) {
      await sendAlert({
        userId: TL._id,
        message: `${user.name} requested leave for ${fromYear}`,
        type: "Leave",
        refId: leave._id,
      });
    }

    // Emit socket events
    if (global._io) {
      global._io.emit("leave_request_received", leave);
      global._io.emit("leave_list_refresh");
    }

    res.status(201).json({ leave, availableBalance: balance.balances });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🟡 MY LEAVES
exports.getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ userId: req.params.userId })
      .sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
};

// 🔴 PENDING LEAVES
exports.getPendingLeaves = async (req, res) => {
  try {
    const { role, teamId, all } = req.query;
    let filter = { status: "Pending" };

    if (role === "Team Leader" && !all) {
      const teamMembers = await User.find({ team: teamId }).select("_id");
      const memberIds = teamMembers.map(m => m._id);
      filter = { 
        status: "Pending",
        currentLevel: "Team Leader",
        userId: { $in: memberIds }
      };
    } else if (role === "Admin" && !all) {
      filter = { status: "Pending", currentLevel: "Admin" };
    } else if (role === "Superadmin" && !all) {
      filter = { status: "Pending", currentLevel: "Superadmin" };
    }

    const leaves = await Leave.find(filter)
      .populate("userId", "name team role")
      .sort({ createdAt: -1 });
      
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
};

// 🟣 ALL LEAVES
exports.getAllLeaves = async (req, res) => {
  try {
    const { teamId, year } = req.query;
    let filter = {};
    
    if (teamId) {
      const teamMembers = await User.find({ team: teamId }).select("_id");
      filter.userId = { $in: teamMembers };
    }
    
    if (year) {
      filter.leaveYear = parseInt(year);
    }
    
    const leaves = await Leave.find(filter)
      .sort({ createdAt: -1 })
      .populate("userId", "name role team profileImage");
      
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
};

// 🔵 LEAVE BALANCE
exports.getLeaveBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const { year } = req.query;
    
    const balance = await getCurrentBalance(userId);
    
    if (year && year !== balance.currentYear) {
      const historyRecord = balance.history.find(h => h.year === parseInt(year));
      if (historyRecord) {
        return res.json({
          balances: historyRecord.balances,
          year: historyRecord.year,
          carriedForward: historyRecord.carriedForward,
          isHistorical: true,
        });
      }
      return res.json({
        balances: {},
        year: parseInt(year),
        message: "No data available for this year",
      });
    }
    
    res.json({
      balances: balance.balances,
      year: balance.currentYear,
      lastResetDate: balance.lastResetDate,
      history: balance.history.map(h => ({
        year: h.year,
        balances: h.balances,
        carriedForward: h.carriedForward,
      })),
    });
    
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📊 LEAVE SUMMARY BY YEAR
exports.getLeaveSummary = async (req, res) => {
  try {
    const { userId } = req.params;
    const { year } = req.query;
    
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    
    const leaves = await Leave.find({
      userId,
      status: { $in: ["Approved", "Pending"] },
      leaveYear: targetYear,
    }).sort({ fromDate: -1 });
    
    const used = {};
    leaves.forEach(leave => {
      const days = dayjs(leave.toDate).diff(dayjs(leave.fromDate), "day") + 1;
      used[leave.type] = (used[leave.type] || 0) + days;
    });
    
    const balance = await getCurrentBalance(userId);
    let available = {};
    
    if (targetYear === balance.currentYear) {
      available = balance.balances;
    } else {
      const historyRecord = balance.history.find(h => h.year === targetYear);
      if (historyRecord) {
        available = historyRecord.balances;
      }
    }
    
    res.json({
      year: targetYear,
      used,
      available,
      leaves: leaves.map(l => ({
        id: l._id,
        type: l.type,
        fromDate: l.fromDate,
        toDate: l.toDate,
        status: l.status,
        days: dayjs(l.toDate).diff(dayjs(l.fromDate), "day") + 1,
      })),
    });
    
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔥 UPDATE LEAVE STATUS
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { role, status, rejectReason } = req.body;
    const leave = await Leave.findById(req.params.id).populate("userId");
    if (!leave) return res.status(404).json({ message: "Not Found" });

    const employee = leave.userId;
    let notifyTo = employee._id;
    let notifyMessage = "";

    if (status === "Rejected") {
      leave.status = "Rejected";
      leave.rejectReason = rejectReason;
      leave.currentLevel = "Completed";
      leave.approval[role] = "Rejected";
      notifyMessage = `❌ Leave Rejected: ${rejectReason}`;
    }

    if (status === "Approved") {
      leave.approval[role] = "Approved";
      
      const nextLevel = {
        "Team Leader": "Admin",
        "Admin": "Superadmin",
        "Superadmin": "Completed",
      };
      
      const next = nextLevel[role];

      if (next !== "Completed") {
        leave.currentLevel = next;
        const nextUser = await User.findOne({ role: next });
        notifyTo = nextUser?._id || employee._id;
        notifyMessage = `${role} Approved. Waiting for ${next}`;
      } else {
        leave.status = "Approved";
        leave.currentLevel = "Completed";

        const diff = dayjs(leave.toDate).diff(dayjs(leave.fromDate), "day") + 1;
        let bal = await getCurrentBalance(leave.userId);
        
        // Only deduct if not already deducted
        if (bal.balances[leave.type] !== Infinity) {
          bal.balances[leave.type] -= diff;
          await bal.save();
        }

        notifyTo = employee._id;
        notifyMessage = `🎉 Leave Fully Approved for ${leave.leaveYear}`;
      }
    }

    await leave.save();

    await sendAlert({
      userId: notifyTo,
      message: notifyMessage,
      type: "Leave",
      refId: leave._id,
    });

    if (global._io) {
      global._io.emit("leave_status_update", {
        leaveId: leave._id,
        status,
        role,
      });
      global._io.emit("leave_list_refresh");
    }

    res.json({ leave });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔄 MANUAL RESET (Admin/Superadmin only)
exports.manualResetBalances = async (req, res) => {
  try {
    const { userId, targetYear } = req.body;
    const { role } = req.user || {};
    
    if (role !== "Admin" && role !== "Superadmin") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    const balance = await LeaveBalance.findOne({ userId });
    if (!balance) {
      return res.status(404).json({ message: "Balance not found" });
    }
    
    balance.currentYear = targetYear - 1;
    await balance.resetForNewYear();
    
    if (global._io) {
      global._io.emit("leave_balances_reset", { userId, year: targetYear });
    }
    
    res.json({
      message: `Balances reset for year ${targetYear}`,
      newBalances: balance.balances,
    });
    
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};