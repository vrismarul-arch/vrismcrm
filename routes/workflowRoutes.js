const express = require("express");
const {
  createWorkflow,
  getWorkflowsByService,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  getLatestWorkflowByService
} = require("../controllers/workflowController");

const router = express.Router();

// Create workflow for a service
router.post("/:serviceId", createWorkflow);

// ✔ Correct route for frontend usage
router.get("/service/:serviceId", getLatestWorkflowByService);

// Used for admin listing
router.get("/:serviceId", getWorkflowsByService);

// Single workflow by ID
router.get("/single/:id", getWorkflowById);

// Update workflow
router.put("/:id", updateWorkflow);

// Delete workflow
router.delete("/:id", deleteWorkflow);

module.exports = router;
