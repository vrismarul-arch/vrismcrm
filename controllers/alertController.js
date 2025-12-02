const Alert = require("../models/Alert");

// 📌 Helper to send alerts from anywhere
const sendAlert = async ({ userId, message, type = "General", refId = null }) => {
  try {
    if (!userId || !message) return;
    await Alert.create({ userId, message, type, refId });

    // 🔥 Socket push realtime
    if (global._io) {
      global._io.to(userId.toString()).emit("alert_received");
    }
  } catch (err) {
    console.error("Alert create error:", err.message);
  }
};

// GET /api/alerts?userId=xxx
const getAlerts = async (req, res) => {
  try {
    const { userId } = req.query;
    const alerts = await Alert.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/alerts/:id/read (mark single)
const markAlertRead = async (req, res) => {
  try {
    await Alert.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// PUT /api/alerts/mark-all-read?userId=xxx
const markAllAlertsRead = async (req, res) => {
  try {
    const { userId } = req.query;
    await Alert.updateMany({ userId }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// DELETE /api/alerts/clear?userId=xxx
const clearAllAlerts = async (req, res) => {
  try {
    const { userId } = req.query;
    await Alert.deleteMany({ userId });
    res.json({ success: true, message: "Cleared" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};
// DELETE /api/alerts/:id (delete single alert)
const deleteSingleAlert = async (req, res) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Alert deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Delete failed" });
  }
};

module.exports = {
  sendAlert,
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
  clearAllAlerts,
  deleteSingleAlert,
};
