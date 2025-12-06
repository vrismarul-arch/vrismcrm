const mongoose = require("mongoose");

const workflowSchema = new mongoose.Schema(
  {
    workflowName: { type: String, required: true },
    service_id: { type: String, required: true },
    nodes: Array,
    edges: Array,
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkFlow", workflowSchema);
