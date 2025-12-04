const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    message: { type: String, required: true },

    type: {
      type: String,
      enum: [ "Work",
        "Task",
        "Project",
        "Leave",
        "General",
        "Event",
        "Subscription"], // ⬅️ ADDED Leave
      default: "General"
    },

    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Alert", alertSchema);
