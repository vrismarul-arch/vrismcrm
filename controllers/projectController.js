// controllers/projectController.js
const Project = require("../models/Project");
const { sendAlert } = require("./alertController");

// ➕ Create
exports.createProject = async (req, res) => {
  try {
    const project = await Project.create(req.body);

    let populatedProject = await Project.findById(project._id)
      .populate("accountId", "name logo businessName")
      .populate("serviceId", "title icon serviceName")
      .populate("members", "name email role")
      .populate("createdBy", "name email role");

    // 🔔 Alert for createdBy
    if (project.createdBy) {
      await sendAlert({
        userId: project.createdBy,
        message: `Project created: ${project.name || "Untitled Project"}`,
        type: "Project",
        refId: project._id,
      });
    }

    // 🔔 Alert for all members
    if (Array.isArray(project.members)) {
      for (const memberId of project.members) {
        await sendAlert({
          userId: memberId,
          message: `You have been added to project: ${project.name || "Untitled Project"}`,
          type: "Project",
          refId: project._id,
        });
      }
    }

    res.status(201).json({ success: true, project: populatedProject });
  } catch (err) {
    console.error("createProject error:", err);
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

    // 🔔 Optional: alert all members about update
    if (Array.isArray(project.members)) {
      for (const member of project.members) {
        await sendAlert({
          userId: member._id,
          message: `Project updated: ${project.name || "Untitled Project"}`,
          type: "Project",
          refId: project._id,
        });
      }
    }

    res.json({ success: true, project });
  } catch (err) {
    console.error("updateProject error:", err);
    res.status(500).json({ message: err.message });
  }
};

// 📌 Get Projects
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
    console.error("getProjects error:", err);
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
    console.error("getProjectById error:", err);
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
    console.error("deleteProject error:", err);
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
    console.error("getProjectStats error:", err);
    res.status(500).json({ message: err.message });
  }
};
