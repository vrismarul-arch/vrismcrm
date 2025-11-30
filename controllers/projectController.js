const Project = require("../models/Project");

// ➕ Create
exports.createProject = async (req, res) => {
  try {
    const project = await Project.create(req.body);

    const populatedProject = await Project.findById(project._id)
      .populate("accountId", "name logo businessName") 
      .populate("serviceId", "title icon serviceName")
      .populate("members", "name email role")
      .populate("createdBy", "name email role");

    res.status(201).json({ success: true, project: populatedProject });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✏️ Update
exports.updateProject = async (req, res) => {
  try {
    let project = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!project)
      return res.status(404).json({ message: "Project not found" });

    project = await Project.findById(project._id)
      .populate("accountId", "name logo businessName")
      .populate("serviceId", "title icon serviceName")
      .populate("members", "name email role")
      .populate("createdBy", "name email role");

    res.json({ success: true, project });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📌 Get Projects (Role Filters Working)
exports.getProjects = async (req, res) => {
  try {
    const { userId, role, status, accountId, serviceId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (accountId) filter.accountId = accountId;
    if (serviceId) filter.serviceId = serviceId;
    if (role === "Employee") filter.members = userId;

    const projects = await Project.find(filter)
      .populate("accountId", "name logo businessName")
      .populate("serviceId", "title icon serviceName")
      .populate("members", "name email role")
      .populate("createdBy", "name email role")
      .sort({ updatedAt: -1 });

    res.json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📍 Get Single
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("accountId", "name logo businessName")
      .populate("serviceId", "title icon serviceName")
      .populate("members", "name email role")
      .populate("createdBy", "name email role");

    if (!project)
      return res.status(404).json({ message: "Project not found" });

    res.json({ success: true, project });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ❌ Delete
exports.deleteProject = async (req, res) => {
  try {
    const deleted = await Project.findByIdAndDelete(req.params.id);

    if (!deleted)
      return res.status(404).json({ message: "Project not found" });

    res.json({ success: true, message: "Deleted Successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📊 Stats
exports.getProjectStats = async (req, res) => {
  try {
    const stats = await Project.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
