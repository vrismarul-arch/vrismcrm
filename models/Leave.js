const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["Sick", "Casual", "Paid", "Unpaid", "Medical"],
      required: true,
    },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    reason: { type: String, required: true },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    approval: {
      teamLeader: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
      admin: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
      superadmin: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    },
rejectReason: { type: String, default: null },

    currentLevel: {
      type: String,
      enum: ["teamLeader", "admin", "superadmin", "completed"],
      default: "teamLeader",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Leave", leaveSchema);
