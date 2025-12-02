const express = require("express");
const router = express.Router();

const {
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
  clearAllAlerts,deleteSingleAlert,
} = require("../controllers/alertController");

router.get("/", getAlerts);
router.put("/:id/read", markAlertRead);
router.put("/mark-all-read", markAllAlertsRead);
router.delete("/clear", clearAllAlerts);
router.delete("/:id", deleteSingleAlert); // 👈 new route

module.exports = router;

