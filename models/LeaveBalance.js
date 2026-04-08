// models/LeaveBalance.js
const mongoose = require("mongoose");

const leaveBalanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    
    balances: {
      Sick: { type: Number, default: 6 },
      Casual: { type: Number, default: 12 },
      Paid: { type: Number, default: 0 },
      Unpaid: { type: Number, default: 0 },
      Medical: { type: Number, default: 0 },
    },
    
    currentYear: {
      type: Number,
      default: () => new Date().getFullYear(),
      required: true,
    },
    
    history: [
      {
        year: { type: Number, required: true },
        balances: {
          Sick: Number,
          Casual: Number,
          Paid: Number,
          Unpaid: Number,
          Medical: Number,
        },
        carriedForward: {
          Sick: Number,
          Casual: Number,
          Paid: Number,
          Unpaid: Number,
          Medical: Number,
        },
        resetDate: { type: Date, default: Date.now },
      },
    ],
    
    carryForwardPolicy: {
      Sick: { type: Number, default: 5 },
      Casual: { type: Number, default: 10 },
      Paid: { type: Number, default: 0 },
      Unpaid: { type: Number, default: 0 },
      Medical: { type: Number, default: 0 },
    },
    
    lastResetDate: { type: Date },
  },
  { timestamps: true }
);

// Method to check if reset is needed
leaveBalanceSchema.methods.needsReset = function() {
  const currentYear = new Date().getFullYear();
  return this.currentYear !== currentYear;
};

// Method to reset balances for new year
leaveBalanceSchema.methods.resetForNewYear = async function() {
  const oldYear = this.currentYear;
  const newYear = new Date().getFullYear();
  
  if (oldYear === newYear) return this;
  
  // Save current year's data to history
  this.history.push({
    year: oldYear,
    balances: { ...this.balances },
    carriedForward: {},
    resetDate: new Date(),
  });
  
  // Calculate carry forward
  const carriedForward = {
    Sick: Math.min(this.balances.Sick, this.carryForwardPolicy.Sick),
    Casual: Math.min(this.balances.Casual, this.carryForwardPolicy.Casual),
    Paid: Math.min(this.balances.Paid, this.carryForwardPolicy.Paid),
    Unpaid: 0,
    Medical: Math.min(this.balances.Medical, this.carryForwardPolicy.Medical),
  };
  
  // Update last history entry with carried forward amounts
  if (this.history.length > 0) {
    this.history[this.history.length - 1].carriedForward = { ...carriedForward };
  }
  
  // Set new balances
  this.balances = {
    Sick: 6 + carriedForward.Sick,
    Casual: 12 + carriedForward.Casual,
    Paid: this.balances.Paid,
    Unpaid: 0,
    Medical: this.balances.Medical,
  };
  
  this.currentYear = newYear;
  this.lastResetDate = new Date();
  
  return this.save();
};

// ✅ Safe export
const LeaveBalance = mongoose.models.LeaveBalance || mongoose.model("LeaveBalance", leaveBalanceSchema);
module.exports = LeaveBalance;