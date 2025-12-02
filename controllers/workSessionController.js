// controllers/workSessionController.js (or whatever name)
const WorkSession = require("../models/WorkSession");
const dayjs = require("dayjs");
const Leave = require("../models/Leave");
const { sendAlert } = require("./alertController");

// 🟢 Monthly Attendance
exports.getMonthlyAttendance = async (req, res) => {
  try {
    const { userId, year, month } = req.query;
    if (!userId || !year || !month)
      return res.status(400).json({ message: "userId, year & month required!" });

    const start = dayjs(`${year}-${month}-01`).startOf("month");
    const end = dayjs(start).endOf("month");

    const workSessions = await WorkSession.find({
      userId,
      loginTime: { $gte: start.toDate(), $lte: end.toDate() },
    });

    const presentSet = new Set(
      workSessions.map((s) => dayjs(s.loginTime).format("YYYY-MM-DD"))
    );

    const leaves = await Leave.find({
      userId,
      status: "Approved",
      fromDate: { $lte: end.toDate() },
      toDate: { $gte: start.toDate() },
    });

    const leaveSet = new Set();
    leaves.forEach((l) => {
      let d = dayjs(l.fromDate);
      while (d.isBefore(l.toDate) || d.isSame(l.toDate)) {
        const formatted = d.format("YYYY-MM-DD");
        leaveSet.add(formatted);
        d = d.add(1, "day");
      }
    });

    const workingDaysSet = new Set([...presentSet, ...leaveSet]);
    const workingDays = workingDaysSet.size;

    const absentSet = new Set();
    let d = start;
    while (d.isBefore(end) || d.isSame(end)) {
      const formatted = d.format("YYYY-MM-DD");
      if (!presentSet.has(formatted) && !leaveSet.has(formatted)) {
        absentSet.add(formatted);
      }
      d = d.add(1, "day");
    }

    res.status(200).json({
      userId,
      month: `${month}-${year}`,
      totalDays: workingDays,
      presentDays: presentSet.size,
      leaveDays: leaveSet.size,
      absentDays: Math.max(workingDays - presentSet.size - leaveSet.size, 0),
      presentDates: [...presentSet],
      leaveDates: [...leaveSet],
      absentDates: [...absentSet],
    });
  } catch (err) {
    console.error("ATTENDANCE ERROR:", err);
    res.status(500).json({ message: "Attendance fetch failed" });
  }
};

// 🟢 Start Work
exports.startWorkSession = async (req, res) => {
  try {
    const { userId, name, email } = req.body;
    const todayStart = dayjs().startOf("day").toDate();
    const todayEnd = dayjs().endOf("day").toDate();

    const existing = await WorkSession.findOne({
      userId,
      loginTime: { $gte: todayStart, $lte: todayEnd },
    });

    if (existing)
      return res.status(400).json({ message: "You have already started today!" });

    const session = new WorkSession({
      userId,
      name,
      email,
      loginTime: new Date(),
      totalHours: 0,
    });
    await session.save();

    // 🔔 Alert: work started
    await sendAlert({
      userId: session.userId,
      message: `Work started at ${session.loginTime.toLocaleTimeString()}`,
      type: "Work",
      refId: session._id,
    });

    res.status(201).json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// 🔴 Stop Work
exports.stopWorkSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await WorkSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (session.logoutTime)
      return res.status(400).json({ message: "Already stopped" });

    const logoutTime = new Date();
    const diffSec = (logoutTime.getTime() - session.loginTime.getTime()) / 1000;
    session.logoutTime = logoutTime;
    session.totalHours = diffSec / 3600;
    await session.save();

    // 🔔 Alert: work stopped
    await sendAlert({
      userId: session.userId,
      message: `Work stopped at ${logoutTime.toLocaleTimeString()}`,
      type: "Work",
      refId: session._id,
    });

    // 🔥 Overtime alert if after 8:00 PM
    const hour = logoutTime.getHours();
    const minute = logoutTime.getMinutes();
    if (hour > 20 || (hour === 20 && minute >= 0)) {
      await sendAlert({
        userId: session.userId,
        message: "You stopped after 8:00 PM. This will be counted as overtime.",
        type: "Work",
        refId: session._id,
      });
    }

    res.status(200).json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// 🟠 Add/Edit EOD
exports.addEod = async (req, res) => {
  try {
    const { sessionId, eod, accountIds, serviceIds, date } = req.body;
    if (!sessionId)
      return res.status(400).json({ message: "sessionId is required" });

    const session = await WorkSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    session.eod = eod || session.eod;
    session.accountIds = accountIds || session.accountIds;
    session.serviceIds = serviceIds || session.serviceIds;
    session.date = date ? new Date(date) : session.date;

    await session.save();
    res.status(200).json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// 🟡 Get today's session for one user
exports.getTodaysSession = async (req, res) => {
  try {
    const { userId } = req.params;
    const todayStart = dayjs().startOf("day").toDate();
    const todayEnd = dayjs().endOf("day").toDate();

    const sessions = await WorkSession.find({
      userId,
      loginTime: { $gte: todayStart, $lte: todayEnd },
    })
      .populate({ path: "accountIds", select: "businessName contactName" })
      .populate({ path: "serviceIds", select: "serviceName category basePrice" })
      .sort({ loginTime: 1 });

    const grouped = sessions.reduce((acc, s) => {
      const date = dayjs(s.loginTime).format("DD-MM-YYYY");
      if (!acc[date]) acc[date] = [];
      acc[date].push(s);
      return acc;
    }, {});

    const formatted = Object.entries(grouped).map(([date, data]) => ({
      date,
      sessions: data,
    }));

    res.status(200).json({ history: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// 🟣 Get all today's sessions (Admin)
exports.getAllTodaysSessions = async (req, res) => {
  try {
    const todayStart = dayjs().startOf("day").toDate();
    const todayEnd = dayjs().endOf("day").toDate();

    const sessions = await WorkSession.find({
      loginTime: { $gte: todayStart, $lte: todayEnd },
    })
      .populate({ path: "accountIds", select: "businessName contactName" })
      .populate({ path: "serviceIds", select: "serviceName category basePrice" })
      .sort({ loginTime: 1 });

    const grouped = sessions.reduce((acc, s) => {
      const date = dayjs(s.loginTime).format("DD-MM-YYYY");
      if (!acc[date]) acc[date] = [];
      acc[date].push(s);
      return acc;
    }, {});

    const formatted = Object.entries(grouped).map(([date, data]) => ({
      date,
      sessions: data,
    }));

    res.status(200).json({ history: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// 🔵 Sessions by date range
exports.getSessionsByDateRange = async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end)
      return res
        .status(400)
        .json({ message: "Start and end dates are required" });

    const startDate = new Date(start);
    const endDate = new Date(end);

    const sessions = await WorkSession.find({
      loginTime: { $gte: startDate, $lte: endDate },
    })
      .populate({ path: "accountIds", select: "businessName contactName" })
      .populate({ path: "serviceIds", select: "serviceName category basePrice" })
      .sort({ loginTime: 1 });

    const grouped = sessions.reduce((acc, s) => {
      const date = dayjs(s.loginTime).format("DD-MM-YYYY");
      if (!acc[date]) acc[date] = [];
      acc[date].push(s);
      return acc;
    }, {});

    const formatted = Object.entries(grouped).map(([date, data]) => ({
      date,
      sessions: data,
    }));

    res.status(200).json({ history: formatted });
  } catch (err) {
    console.error("Error fetching session history:", err);
    res.status(500).json({ message: "Failed to fetch session history" });
  }
};
