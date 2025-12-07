// models/WorkFlow.js
const mongoose = require("mongoose");

const nodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // React Flow node id
    data: { type: mongoose.Schema.Types.Mixed }, // { label: "branding" } etc.
    position: { type: mongoose.Schema.Types.Mixed },
    style: { type: mongoose.Schema.Types.Mixed },
    width: Number,
    height: Number,
    selected: Boolean,
    positionAbsolute: { type: mongoose.Schema.Types.Mixed },
    dragging: Boolean,

    // ✅ status for node (template level)
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed"],
      default: "Pending",
    },
  },
  { _id: false }
);

const edgeSchema = new mongoose.Schema(
  {
    source: String,
    sourceHandle: { type: String, default: null },
    target: String,
    targetHandle: { type: String, default: null },
    animated: { type: Boolean, default: false },
    id: String,
    selected: { type: Boolean, default: false },
  },
  { _id: false }
);

const workflowSchema = new mongoose.Schema(
  {
    workflowName: { type: String, required: true },

    // you are using string UUID here like "9c924c77-..."
    service_id: { type: String, required: true },

    nodes: [nodeSchema],
    edges: [edgeSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkFlow", workflowSchema);
