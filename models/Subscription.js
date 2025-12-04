const mongoose = require("mongoose");

const subscriptionHistorySchema = new mongoose.Schema(
  {
    previousPlanName: String,
    newPlanName: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedDate: { type: Date, default: Date.now },
    note: String,
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    businessAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessAccount",
      required: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BrandService",
      required: true,
    },

    // ⭐ Stored as plain value (NOT ref)
    planName: { type: String, required: true },
    planPriceMonthly: Number,
    planPriceYearly: Number,

    billingCycle: {
      type: String,
      enum: ["Monthly", "Yearly"],
      default: "Monthly",
    },

    amountPaid: Number,
    gstRate: Number,
    totalWithGST: Number,
    orderId: String,
    paymentId: String,
    purchaseDate: { type: Date, default: Date.now },
    renewalDate: Date,

    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "pending"],
      default: "active",
    },
    autoRenew: { type: Boolean, default: true },

    history: [subscriptionHistorySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
