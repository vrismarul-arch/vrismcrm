const mongoose = require("mongoose");

// Schema for an individual note within a Project
const noteSchema = new mongoose.Schema(
  {
    text: String,
    timestamp: String, 
    author: String,
  },
  { _id: false }
);

// Schema for an individual step within a Project
const stepSchema = new mongoose.Schema({
  stepName: { type: String, required: true },
  url: { type: String, default: "" },
  description: { type: String, default: "" },
  status: {
    type: String,
    enum: ["Pending", "In Progress", "Review", "Completed", "On Hold"],
    default: "Pending",
  },
  order: { type: Number, default: 1 }
});

// Main Project Schema
const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,

    status: {
      type: String,
      enum: ["Planned", "In Progress", "Completed", "On Hold", "Cancelled"],
      default: "Planned",
    },

    steps: [stepSchema], // Embedded sub-documents for project steps
    
    // *** Added the notes field here ***
    notes: [noteSchema], // Embedded sub-documents for project notes

    startDate: { type: Date, required: true },
    endDate: Date,
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessAccount", required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "BrandService", required: true },

    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    attachments: [{ filename: String, url: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);