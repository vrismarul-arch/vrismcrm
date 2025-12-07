const WorkFlow = require("../models/WorkFlow");

// Create workflow
exports.createWorkflow = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { workflowName, nodes, edges } = req.body;

    const workflow = await WorkFlow.create({
      workflowName,
      service_id: serviceId,
      nodes,
      edges,
    });

    res.json({ success: true, workflow });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// All workflows under a service
exports.getWorkflowsByService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const data = await WorkFlow.find({ service_id: serviceId });
    res.json({ success: true, workflows: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 📌 VIEW WORKFLOW (Fix Applied)
exports.getWorkflowById = async (req, res) => {
  try {
    const workflow = await WorkFlow.findById(req.params.id);

    if (!workflow)
      return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, workflow });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Update workflow
exports.updateWorkflow = async (req, res) => {
  try {
    const workflow = await WorkFlow.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, workflow });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete workflow
exports.deleteWorkflow = async (req, res) => {
  try {
    await WorkFlow.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Workflow deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Latest workflow for Project
exports.getLatestWorkflowByService = async (req, res) => {
  try {
    const workflow = await WorkFlow.findOne({ service_id: req.params.serviceId });

    res.json({ success: true, workflow: workflow || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
