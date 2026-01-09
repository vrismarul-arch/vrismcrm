const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");

// Task Routes
router.get("/", taskController.getTasks);
router.get("/:id", taskController.getTask);
router.post("/", taskController.createTask);
router.put("/:id", taskController.updateTask);
router.delete("/:id", taskController.deleteTask);

// ✅ ADD NOTE ROUTE
router.put("/:id/add-note",  taskController.addTaskNote);

module.exports = router;
