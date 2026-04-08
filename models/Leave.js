// models/Leave.js
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
    
    leaveYear: {
      type: Number,
      default: () => new Date().getFullYear(),
    },

    approval: {
      "Team Leader": {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending",
      },
      "Admin": {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending",
      },
      "Superadmin": {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending",
      },
    },

    rejectReason: String,

    currentLevel: {
      type: String,
      enum: ["Team Leader", "Admin", "Superadmin", "Completed"],
      default: "Team Leader",
    },
  },
  { timestamps: true }
);

const Leave = mongoose.models.Leave || mongoose.model("Leave", leaveSchema);
module.exports = Leave;