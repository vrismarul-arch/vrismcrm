const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },

    status: {
      type: String,
      enum: ["Planned", "In Progress", "Completed", "On Hold", "Cancelled"],
      default: "Planned",
    },

    startDate: { type: Date, required: true },
    endDate: { type: Date },

    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessAccount",
      required: true,
    },

    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BrandService",
      required: true,
    },

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    attachments: [
      {
        filename: String,
        url: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
