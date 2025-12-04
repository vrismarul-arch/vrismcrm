const Subscription = require("../models/Subscription");
const BusinessAccount = require("../models/BusinessAccount");
const BrandService = require("../models/BrandService");
const { sendAlert } = require("./alertController");

// 🔥 Helper to get correct Alert receiver (Owner -> Fallback to Client)
const getAlertReceiverUserId = async (businessAccountId) => {
  const business = await BusinessAccount.findById(businessAccountId)
    .populate("owner", "_id")
    .populate("clients", "_id");

  if (business?.owner?._id) return business.owner._id;  // Case 1️⃣: Owner exists
  if (business?.clients?.length > 0) return business.clients[0]._id; // Case 2️⃣: First Client
  
  return null; // Case 3️⃣: No user found
};

// 📌 Create Subscription
exports.createSubscription = async (req, res) => {
  try {
    const {
      businessAccount,
      service,
      planId,
      billingCycle,
      amountPaid,
      gstRate,
      orderId,
      paymentId,
    } = req.body;

    if (!businessAccount || !service || !planId)
      return res.status(400).json({ message: "Missing required fields" });

    const serviceDoc = await BrandService.findById(service);
    if (!serviceDoc) return res.status(404).json({ message: "Service Not Found" });

    const plan = serviceDoc.plans.id(planId);
    if (!plan) return res.status(404).json({ message: "Plan Not Found" });

    const renewalDate = new Date();
    renewalDate.setMonth(
      renewalDate.getMonth() + (billingCycle === "Monthly" ? 1 : 12)
    );

    const totalWithGST = amountPaid + (amountPaid * gstRate) / 100;

    const subscription = await Subscription.create({
      businessAccount,
      service,
      currentPlan: planId,
      planName: plan.name,
      planPriceMonthly: plan.priceMonthly,
      planPriceYearly: plan.priceYearly,
      billingCycle,
      amountPaid,
      gstRate,
      totalWithGST,
      orderId,
      paymentId,
      renewalDate,
    });

    await BusinessAccount.findByIdAndUpdate(businessAccount, {
      selectedService: service,
      selectedPlan: planId,
      billingCycle,
      totalPrice: totalWithGST,
      gstRate,
      isCustomer: true,
      status: "Customer",
    });

    // 🔔 Alert to Owner or Client
    const receiverId = await getAlertReceiverUserId(businessAccount);
    if (receiverId) {
      await sendAlert({
        userId: receiverId,
        message: `New Subscription Activated - ${plan.name}`,
        type: "Subscription",
        refId: subscription._id,
      });
    }

    const created = await Subscription.findById(subscription._id)
      .populate("service", "serviceName");

    res.status(201).json(created);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📌 Get All Subscriptions (Admin)
exports.getAllSubscriptions = async (req, res) => {
  try {
    const data = await Subscription.find()
      .populate("businessAccount", "businessName contactName")
      .populate("service", "serviceName");

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📌 Get Subscriptions by Business
exports.getSubscriptionsByBusiness = async (req, res) => {
  try {
    const subs = await Subscription.find({
      businessAccount: req.params.id,
    }).populate("service", "serviceName plans");

    res.json(subs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch subscriptions" });
  }
};

// 📌 Update Plan
exports.updatePlan = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { planId, changedBy, note, service } = req.body;

    const serviceDoc = await BrandService.findById(service);
    if (!serviceDoc) return res.status(404).json({ message: "Service Not Found" });

    const newPlan = serviceDoc.plans.id(planId);
    if (!newPlan) return res.status(404).json({ message: "Plan Not Found" });

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) return res.status(404).json({ message: "Subscription Not Found" });

    const oldPlanName = subscription.planName;

    subscription.history.push({
      previousPlanName: oldPlanName,
      newPlanName: newPlan.name,
      changedBy,
      note,
    });

    subscription.currentPlan = planId;
    subscription.planName = newPlan.name;
    subscription.planPriceMonthly = newPlan.priceMonthly;
    subscription.planPriceYearly = newPlan.priceYearly;

    await subscription.save();

    // 🔔 Alert to Owner or Client
    const receiverId = await getAlertReceiverUserId(subscription.businessAccount);
    if (receiverId) {
      await sendAlert({
        userId: receiverId,
        message: `Subscription Plan Updated: ${oldPlanName} → ${newPlan.name}`,
        type: "Subscription",
        refId: subscription._id,
      });
    }

    const updated = await Subscription.findById(subscriptionId)
      .populate("service", "serviceName");

    res.json({ message: "Plan Updated", subscription: updated });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📌 Cancel Subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const sub = await Subscription.findByIdAndUpdate(
      req.params.id,
      { status: "cancelled", autoRenew: false },
      { new: true }
    ).populate("service", "serviceName");

    // 🔔 Alert to Owner or Client
    const receiverId = await getAlertReceiverUserId(sub.businessAccount);
    if (receiverId) {
      await sendAlert({
        userId: receiverId,
        message: `Subscription Cancelled - ${sub.service.serviceName}`,
        type: "Subscription",
        refId: sub._id,
      });
    }

    res.json({ message: "Subscription Cancelled", sub });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
