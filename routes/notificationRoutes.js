const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController"); // Adjust path as needed

// 🔔 GET /api/notifications/:userId - Fetch all notifications for a user
router.get("/:userId", notificationController.getUserNotifications);

// 🟢 POST /api/notifications/read - Mark multiple notifications as read
router.post("/read", notificationController.markAsRead);

// 🔴 DELETE /api/notifications/:notificationId - Delete a specific notification
router.delete("/:notificationId", notificationController.deleteNotification);

module.exports = router;