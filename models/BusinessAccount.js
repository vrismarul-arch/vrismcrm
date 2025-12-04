// models/BusinessAccount.js
const mongoose = require("mongoose");

// Notes
const noteSchema = new mongoose.Schema(
  {
    text: String,
    timestamp: String,
    author: String,
  },
  { _id: false }
);

// Contact Person
const contactPersonSchema = new mongoose.Schema({
  name: String,
  email: String,
  phoneNumber: String,
});

// Follow-ups
const followUpSchema = new mongoose.Schema(
  {
    date: Date,
    note: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
  },
  { _id: false }
);

const businessAccountSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // optional: for fallback alert receiver
    selectedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    contactName: { type: String, required: true },
    contactEmail: String,
    contactNumber: { type: String, required: true },

    additionalContactPersons: [contactPersonSchema],

    gstNumber: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    country: String,
    pincode: Number,
    website: String,

    typeOfLead: [{ type: String, enum: ['Fixed client', 'Revenue based client', 'Vrism Product',"others"] }],

    status: {
      type: String,
      enum: [
        "Active",
        "Pipeline",
        "Quotations",
        "Customer",
        "Closed",
        "TargetLeads",
      ],
      default: "Active",
    },

    sourceType: { type: String, default: "Direct" },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    selectedService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BrandService",
    },

    selectedPlan: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    billingCycle: {
      type: String,
      enum: ["Monthly", "Yearly","One Time"],
      default: "Monthly",
    },

    totalPrice: { type: Number, default: 0 },

    gstRate: { type: Number, default: 18 },

    notes: [noteSchema],
    followUps: [followUpSchema],

    quotations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Quotation" }],
    clients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    isCustomer: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BusinessAccount", businessAccountSchema);
