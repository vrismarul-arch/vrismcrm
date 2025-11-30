const mongoose = require("mongoose");

const leaveBalanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, default: new Date().getFullYear() },
    balances: {
      Sick: { type: Number, default: 8 },
      Casual: { type: Number, default: 12 },
      Medical: { type: Number, default: 5 },
      Paid: { type: Number, default: Infinity },
      Unpaid: { type: Number, default: Infinity },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LeaveBalance", leaveBalanceSchema);
