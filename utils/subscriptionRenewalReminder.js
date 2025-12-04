const Subscription = require("../models/Subscription");
const BusinessAccount = require("../models/BusinessAccount");
const { sendAlert } = require("../controllers/alertController");

// Helper → find who should receive alert
const getAlertReceiverUserId = async (businessAccountId) => {
  const business = await BusinessAccount.findById(businessAccountId)
    .populate("owner", "_id")
    .populate("clients", "_id");

  if (business?.owner?._id) return business.owner._id; // Owner exists
  if (business?.clients?.length > 0) return business.clients[0]._id; // Fallback → client

  return null;
};

const checkRenewalAlerts = async () => {
  console.log("🔄 Running Subscription Renewal Reminder Job...");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reminderDate = new Date(today);
  reminderDate.setDate(today.getDate() + 5); // 5 days early warning
  reminderDate.setHours(0, 0, 0, 0);

  const subs = await Subscription.find({
    status: "active",
    renewalDate: {
      $gte: reminderDate,
      $lt: new Date(reminderDate.getTime() + 86400000), // 24h range
    },
  }).populate("service", "serviceName");

  for (const sub of subs) {
    const receiverId = await getAlertReceiverUserId(sub.businessAccount);
    if (!receiverId) continue;

    await sendAlert({
      userId: receiverId,
      type: "Subscription",
      refId: sub._id,
      message: `⏳ Subscription "${sub.service.serviceName}" expires in 5 days. Renew soon!`,
    });

    console.log("🔔 Reminder sent for subscription:", sub._id);
  }

  console.log("✔ Renewal Reminder Job Completed.");
};

module.exports = checkRenewalAlerts;
