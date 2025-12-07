const mongoose = require("mongoose");

// Schema for reusable step templates
const processStepSchema = new mongoose.Schema(
  {
    stepName: { type: String, required: true },
    stepType: { type: String, required: false }, // Matches Service name/category for grouping
    url: { type: String, default: "" },
    description: { type: String, default: "" },
    status: { type: String, default: "Active" },
    order: { type: Number, default: 1 },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ProcessStep ||
  mongoose.model("ProcessStep", processStepSchema);