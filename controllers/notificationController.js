    const Notification = require("../models/Notification"); // <-- Assuming this model exists
const dayjs = require("dayjs");

// 🔔 Get all notifications for a specific user
exports.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Fetch notifications for the user, sorting by newest first
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 }) // Newest first
      .limit(50); // Limit to last 50 for performance

    res.status(200).json({ notifications });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

// 🟢 Mark notifications as read
exports.markAsRead = async (req, res) => {
    try {
        const { notificationIds } = req.body;

        await Notification.updateMany(
            { _id: { $in: notificationIds } },
            { $set: { read: true } }
        );

        res.status(200).json({ message: "Notifications marked as read" });
    } catch (err) {
        console.error("Error marking notifications as read:", err);
        res.status(500).json({ message: "Failed to mark notifications as read" });
    }
};

// 🔴 Delete a notification
exports.deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;
        
        await Notification.findByIdAndDelete(notificationId);
        
        res.status(200).json({ message: "Notification deleted successfully" });
    } catch (err) {
        console.error("Error deleting notification:", err);
        res.status(500).json({ message: "Failed to delete notification" });
    }
};