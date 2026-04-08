// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// 🔥 Normal User APIs
router.get("/", userController.getAllUsers);
router.get("/:id", userController.getSingleUser);
router.post("/", userController.createUser);
router.put("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);

// 🔥 Transfer user
router.put("/transfer/:id", userController.transferUser);

// 🔥 Presence update
router.post("/status/update", userController.updateStatus);

// 🔥 Chat Sorted User List (WhatsApp Style Sorting)
router.get("/chat/list", userController.getChatSortedUsers);

// 🆕 DOB and Birthday Related Routes
router.get("/birthdays/today", userController.getBirthdayUsers);
router.get("/birthdays/upcoming", userController.getUpcomingBirthdays);
router.get("/birthdays/stats", userController.getBirthdayStats);
router.get("/birthdays/user/:userId", userController.checkUserBirthday);
router.get("/age-range", userController.getUsersByAgeRange);

module.exports = router;