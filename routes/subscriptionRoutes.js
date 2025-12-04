const express = require("express");
const {
  createSubscription,
  getSubscriptionsByBusiness,
  updatePlan,
  cancelSubscription,
  getAllSubscriptions,
} = require("../controllers/subscriptionController");

const router = express.Router();

router.get("/all", getAllSubscriptions); // Admin all subs
router.post("/", createSubscription); // Create sub
router.get("/:id", getSubscriptionsByBusiness); // Client + Admin view by business
router.put("/upgrade/:subscriptionId", updatePlan); // Change plan
router.put("/cancel/:id", cancelSubscription); // Cancel plan

module.exports = router;
