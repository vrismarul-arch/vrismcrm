const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");

// Task Routes
router.get("/", taskController.getTasks);       // GET all tasks
router.get("/:id", taskController.getTask);     // GET task by ID
router.post("/", taskController.createTask);    // CREATE task
router.put("/:id", taskController.updateTask);  // UPDATE task
router.delete("/:id", taskController.deleteTask); // DELETE task

module.exports = router;
