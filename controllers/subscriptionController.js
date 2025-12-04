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

    // ⭐ Default GST if not set properly
    const finalGstRate = Number(gstRate) > 0 ? Number(gstRate) : 18;

    // ⭐ GST Total
    const totalWithGST = Math.round(amountPaid + (amountPaid * finalGstRate) / 100);

    // ⭐ Renewal Date: Always + 12 Months for Yearly & One Time
    let renewalDate = new Date();
    if (billingCycle === "Monthly") {
      renewalDate.setMonth(renewalDate.getMonth() + 1);
    } else {
      renewalDate.setMonth(renewalDate.getMonth() + 12); // Yearly + One Time
    }

    const subscription = await Subscription.create({
      businessAccount,
      service,
      currentPlan: planId,
      planName: plan.name,
      planPriceMonthly: plan.priceMonthly,
      planPriceYearly: plan.priceYearly,
      planPriceOneTime: plan.priceOneTime || 0,
      billingCycle,
      amountPaid,
      gstRate: finalGstRate,
      totalWithGST,
      orderId,
      paymentId,
      renewalDate,
      status: "active", // One Time also active
      autoRenew: billingCycle !== "One Time", // disable auto-renew for One Time
    });

    // 🔄 Update Business Account
    await BusinessAccount.findByIdAndUpdate(businessAccount, {
      selectedService: service,
      selectedPlan: planId,
      billingCycle,
      totalPrice: totalWithGST,
      gstRate: finalGstRate,
      isCustomer: true,
      status: "Customer",
    });

    // 🔔 Send Alert
    const receiverId = await getAlertReceiverUserId(businessAccount);
    if (receiverId) {
      await sendAlert({
        userId: receiverId,
        message: `Subscription Activated - ${plan.name}`,
        type: "Subscription",
        refId: subscription._id,
      });
    }

    const created = await Subscription.findById(subscription._id)
      .populate("service", "serviceName");

    res.status(201).json(created);

  } catch (error) {
    console.error("Create Subscription Error:", error);
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
exports.getSubscriptionDetails = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id)
      .populate("service", "serviceName plans")
      .populate("businessAccount", "businessName contactNumber contactEmail");

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    // 🟢 Match plan by name (since Subscription stores only snapshot name)
    let selectedPlan = null;
    if (subscription.service?.plans) {
      selectedPlan = subscription.service.plans.find(
        (p) => p.name === subscription.planName
      );
    }

    res.json({
      _id: subscription._id,
      businessName: subscription.businessAccount?.businessName,
      serviceName: subscription.service?.serviceName,
      billingCycle: subscription.billingCycle,
      status: subscription.status,
      renewalDate: subscription.renewalDate,
      amountPaid: subscription.amountPaid,
      gstRate: subscription.gstRate,
      totalWithGST: subscription.totalWithGST,
      orderId: subscription.orderId,
      planName: subscription.planName,
      planFeatures: selectedPlan?.features || [], // 🟢 Now always safe
    });

  } catch (error) {
    console.error("Details Fetch Error:", error);
    res.status(500).json({ message: error.message });
  }
};
