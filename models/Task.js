const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },

    // Old single reason (keep for backward compatibility)
    reason: { type: String },

    // ✅ NEW: Reason / Notes History
    reasonHistory: [
      {
        text: { type: String, required: true },
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        createdAt: { type: Date, default: Date.now }
      }
    ],

    timeRequired: { type: String },

    extraAttachment: [{ type: String }],
    attachments: [{ type: String }],

    isImportant: { type: Boolean, default: false },

    startTime: { type: String },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      }
    ],

    accountId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BusinessAccount"
      }
    ],

    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BrandService"
    },

    status: {
      type: String,
      enum: ["To Do", "In Progress", "Review", "Completed", "Overdue"],
      default: "To Do"
    },

    assignedDate: { type: Date, default: Date.now },
    dueDate: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
