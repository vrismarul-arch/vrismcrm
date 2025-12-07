// controllers/notificationController.js
const Notification = require("../models/Notification");

exports.createNotification = async (req, res) => {
  try {
    const { userId, fromUserId, message, type } = req.body;

    const notification = await Notification.create({
      user: userId,
      fromUser: fromUserId || null,
      message,
      type: type || "message", // default to "message" so enum doesn't break
      read: false,
    });

    // 🔥 Real-time push through WebSocket to RECEIVER's room
    if (global._io) {
      global._io.to(userId.toString()).emit("new_notification", {
        _id: notification._id,
        user: notification.user,
        fromUser: fromUserId,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt,
      });
    }

    res.status(201).json(notification);
  } catch (err) {
    console.error("createNotification error:", err);
    res.status(500).json({ error: err.message });
  }
};

// --- MODIFIED FUNCTION ---
exports.getNotificationsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const notifications = await Notification.find({ user: userId })
      .populate("fromUser", "name email profileImage") // **<-- ADDED profileImage HERE**
      .sort({ createdAt: -1 });

    res.json({ notifications });
  } catch (err) {
    console.error("getNotificationsByUser error:", err);
    res.status(500).json({ error: err.message });
  }
};
// -------------------------

exports.markAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;

    if (!notificationIds || !notificationIds.length) {
      return res.json({ message: "Nothing to update" });
    }

    // Update all as read
    await Notification.updateMany(
      { _id: { $in: notificationIds } },
      { $set: { read: true } }
    );

    // Find which users were affected (usually only 1 user)
    const affected = await Notification.find({ _id: { $in: notificationIds } }).select("user");
    const userIds = [...new Set(affected.map(n => n.user.toString()))];

    // 🔁 Let frontend reload counts for each affected user
    if (global._io) {
      userIds.forEach(uid => {
        global._io.to(uid).emit("notifications_updated");
      });
    }

    res.json({ message: "Marked as read" });
  } catch (err) {
    console.error("markAsRead error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notif = await Notification.findByIdAndDelete(req.params.id);

    if (notif && global._io) {
      // After delete, notify this user to refresh notifications
      global._io.to(notif.user.toString()).emit("notifications_updated");
    }

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("deleteNotification error:", err);
    res.status(500).json({ error: err.message });
  }
};