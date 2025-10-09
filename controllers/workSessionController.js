const WorkSession = require('../models/WorkSession');
const dayjs = require('dayjs');

// Start Work
exports.startWorkSession = async (req, res) => {
  try {
    const { userId, name, email } = req.body;
    const todayStart = dayjs().startOf('day').toDate();
    const todayEnd = dayjs().endOf('day').toDate();

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

    res.status(201).json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Stop Work
exports.stopWorkSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await WorkSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (session.logoutTime) return res.status(400).json({ message: "Already stopped" });

    const logoutTime = new Date();
    const diffSec = (logoutTime.getTime() - session.loginTime.getTime()) / 1000;

    session.logoutTime = logoutTime;
    session.totalHours = diffSec / 3600; // Convert seconds to hours
    await session.save();

    res.status(200).json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Add or Edit EOD
exports.addEod = async (req, res) => {
  try {
    const { sessionId, eod, accountIds, serviceIds, date } = req.body;
    if (!sessionId) return res.status(400).json({ message: "sessionId is required" });

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

// Get today's session for a specific user
exports.getTodaysSession = async (req, res) => {
  try {
    const { userId } = req.params;
    const todayStart = dayjs().startOf('day').toDate();
    const todayEnd = dayjs().endOf('day').toDate();

    const session = await WorkSession.findOne({
      userId,
      loginTime: { $gte: todayStart, $lte: todayEnd },
    })
      .populate({ path: "accountIds", select: "businessName contactName" })
      .populate({ path: "serviceIds", select: "serviceName category basePrice" });

    res.status(200).json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Get all today's sessions (Admin)
exports.getAllTodaysSessions = async (req, res) => {
  try {
    const todayStart = dayjs().startOf('day').toDate();
    const todayEnd = dayjs().endOf('day').toDate();

    const sessions = await WorkSession.find({ loginTime: { $gte: todayStart, $lte: todayEnd } })
      .populate({ path: "accountIds", select: "businessName contactName" })
      .populate({ path: "serviceIds", select: "serviceName category basePrice" })
      .sort({ loginTime: 1 });

    res.status(200).json({ sessions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
