const express = require("express");
const router = express.Router();
const controller = require("../controllers/brandServiceController");

router.get("/", controller.getAllServices);
router.get("/:id", controller.getServiceById);
router.post("/", controller.createService);
router.put("/:id", controller.updateService);
router.delete("/:id", controller.deleteService);
router.put('/:id/notes', controller.updateServiceNotes);

// PLAN
router.post("/:id/plans", controller.addPlan);
router.put("/:serviceId/plans/:planId", controller.updatePlan);
router.delete("/:serviceId/plans/:planId", controller.deletePlan);

module.exports = router;
