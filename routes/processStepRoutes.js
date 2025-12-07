// processStepRoutes.js
const express = require("express");
const {
  createStepGroup,
  getGroupedSteps,
  updateStepGroup,  // <-- Must be imported
  deleteStepGroup,  // <-- Must be imported
  deleteStep,       // <-- Must be imported
} = require("../controllers/processStepController");

const router = express.Router();

router.post("/", createStepGroup);
router.get("/", getGroupedSteps);

// PUT route uses the stepType as the parameter
router.put("/:stepType", updateStepGroup); 

// DELETE route for the entire group by stepType
router.delete("/:stepType", deleteStepGroup); 

// DELETE route for a single step by Mongoose _id (AVOIDS CONFLICT with group delete)
router.delete("/step/:id", deleteStep); 

module.exports = router;