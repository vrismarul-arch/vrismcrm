const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const User = require("../models/User");
const { sendAlert } = require("./alertController");
const dayjs = require("dayjs");

const fmt = (d) => dayjs(d).format("DD MMM YYYY");

// 🟢 APPLY LEAVE
exports.applyLeave = async (req, res) => {
  try {
    const { userId, type, fromDate, toDate, reason } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const diff = dayjs(toDate).diff(dayjs(fromDate), "day") + 1;
    let balance = await LeaveBalance.findOne({ userId });

    if (!balance) balance = await LeaveBalance.create({ userId });

    if (balance.balances[type] !== Infinity && balance.balances[type] < diff)
      return res.status(400).json({ message: "Not enough balance" });

    const leave = await Leave.create({
      userId,
      type,
      fromDate,
      toDate,
      reason,
      status: "Pending",
      currentLevel: "Team Leader",
    });

    const TL = await User.findOne({ team: user.team, role: "Team Leader" });

    await sendAlert({
      userId,
      message: `Leave Requested (${fmt(fromDate)} - ${fmt(toDate)})`,
      type: "Leave",
      refId: leave._id,
    });

    if (TL && TL._id.toString() !== userId)
      await sendAlert({
        userId: TL._id,
        message: `${user.name} requested leave`,
        type: "Leave",
        refId: leave._id,
      });

    global._io.emit("leave_request_received", leave);

    res.status(201).json({ leave });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🟡 MY LEAVES
exports.getMyLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch {
    res.status(500).json({ message: "Error" });
  }
};

// 🔴 PENDING (Role Filter)
exports.getPendingLeaves = async (req, res) => {
  try {
    const { role, teamId } = req.query;
    let filter = { status: "Pending" };

    if (role === "Team Leader") filter = { currentLevel: "Team Leader", "userId.team": teamId };
    if (role === "Admin") filter = { currentLevel: "Admin" };
    if (role === "Superadmin") filter = { currentLevel: "Superadmin" };

    const leaves = await Leave.find(filter).populate("userId", "name team role");
    res.json(leaves);

  } catch {
    res.status(500).json({ message: "Error" });
  }
};

// 🟣 All Leaves (Role View)
exports.getAllLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find()
      .sort({ createdAt: -1 })
      .populate("userId", "name role team");
    res.json(leaves);
  } catch {
    res.status(500).json({ message: "Error" });
  }
};

// 🔵 Leave Balance
exports.getLeaveBalance = async (req, res) => {
  try {
    const bal = await LeaveBalance.findOne({ userId: req.params.userId });
    res.json(bal?.balances || {});
  } catch {
    res.status(500).json({ message: "Error" });
  }
};

// 🟣 Convert Role → Next Stage
const nextLevel = {
  "Team Leader": "Admin",
  "Admin": "Superadmin",
  "Superadmin": "Completed",
};

// 🔥 STATUS UPDATE
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
      const next = nextLevel[role];

      if (next !== "Completed") {
        leave.currentLevel = next;

        const nextUser = await User.findOne({ role: next });
        notifyTo = nextUser?._id;
        notifyMessage = `${role} Approved. Waiting for ${next}`;
      } else {
        leave.status = "Approved";
        leave.currentLevel = "Completed";

        const diff = dayjs(leave.toDate).diff(dayjs(leave.fromDate), "day") + 1;
        let bal = await LeaveBalance.findOne({ userId: leave.userId });

        if (bal.balances[leave.type] !== Infinity) {
          bal.balances[leave.type] -= diff;
          await bal.save();
        }

        notifyTo = employee._id;
        notifyMessage = `🎉 Leave Fully Approved`;
      }
    }

    await leave.save();

    await sendAlert({
      userId: notifyTo,
      message: notifyMessage,
      type: "Leave",
      refId: leave._id,
    });

    global._io.emit("leave_status_update", {
      leaveId: leave._id,
      status,
    });

    res.json({ leave });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
