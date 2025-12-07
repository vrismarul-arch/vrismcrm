/**
 * PROJECT CONTROLLER MODULE
 * * This module handles CRUD operations for the Project model, including:
 * 1. Project creation with automatic step assignment based on the service type.
 * 2. Project updates, ensuring embedded steps are re-sorted by their array index.
 * 3. Retrieval of single and multiple projects, with robust filtering based on user role (Employee, Client) and direct query parameters.
 * 4. Deletion of projects.
 * 5. Aggregation for project status statistics.
 * * Dependencies: 
 * - Project Model (Mongoose Schema)
 * - ProcessStep Model (For template steps)
 * - alertController (For sending user notifications)
 */

const Project = require("../models/Project");
const ProcessStep = require("../models/ProcessStep");
const { sendAlert } = require("./alertController"); // Assuming alertController exists

// 🆕 Load default process steps by matching Service Type
const getServiceSteps = async (serviceName) => {
  const templateSteps = await ProcessStep.find({ stepType: serviceName }).sort({ order: 1 });

  return templateSteps.map((step, idx) => ({
    stepName: step.stepName,
    url: step.url || "",
    description: step.description || "",
    status: "Pending", // Project steps start as Pending
    order: idx + 1,
  }));
};

// ➕ Create Project + Auto Assign Steps
exports.createProject = async (req, res) => {
  try {
    let payload = req.body;

    // 🆕 Auto Steps Assignment
    if (!payload.steps || payload.steps.length === 0) {
      const serviceName = payload.serviceName || payload.serviceId?.serviceName;

      if (serviceName) {
        payload.steps = await getServiceSteps(serviceName);
      }
    }

    const project = await Project.create(payload);

    let populatedProject = await Project.findById(project._id)
      .populate("accountId", "name logo businessName")
      .populate("serviceId", "title icon serviceName")
      .populate("members", "name email role")
      .populate("createdBy", "name email role");

    // 🔔 Alerts to creator
    if (project.createdBy) {
      await sendAlert({
        userId: project.createdBy,
        message: `Project created: ${project.name}`,
        type: "Project",
        refId: project._id,
      });
    }

    // 🔔 Alerts to members
    if (Array.isArray(project.members)) {
      for (const memberId of project.members) {
        await sendAlert({
          userId: memberId,
          message: `You have been added to project: ${project.name}`,
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

// ✏️ Update Project + Steps
exports.updateProject = async (req, res) => {
  try {
    // Re-sort steps based on array index if steps are updated
    if (req.body.steps) {
      req.body.steps = req.body.steps.map((s, i) => ({
        ...s,
        order: i + 1,
      }));
    }

    let project = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!project)
      return res.status(404).json({ message: "Project not found" });

    // Populate the project again for the response
    project = await Project.findById(project._id)
      .populate("accountId", "name logo businessName")
      .populate("serviceId", "title icon serviceName")
      .populate("members", "name email role")
      .populate("createdBy", "name email role");

    // 🔔 Alerts: Notify update
    if (Array.isArray(project.members)) {
      for (const member of project.members) {
        await sendAlert({
          userId: member._id,
          message: `Project updated: ${project.name}`,
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

// 📌 Get Projects (Filter Support)
exports.getProjects = async (req, res) => {
  try {
    const { userId, role, status, accountId, serviceId } = req.query;

    const filter = {};

    // ------------------------------
    // 1️⃣ DIRECT FILTERS (Frontend request)
    // ------------------------------
    if (status) filter.status = status;
    if (serviceId) filter.serviceId = serviceId;
    if (accountId) filter.accountId = accountId; // Client Dashboard uses THIS
    // ------------------------------

    // ------------------------------
    // 2️⃣ ROLE BASED FILTERS
    // ------------------------------
    if (userId && role) {
      if (role === "Employee") {
        filter.members = userId; // employee sees assigned projects
      }

      if (role === "Client") {
        // Client sees projects linked to their accountId (business account)
        const clientUser = await Project.model("User")
          .findById(userId)
          .select("businessAccount");

        if (clientUser && clientUser.businessAccount) {
          filter.accountId = clientUser.businessAccount;
        }
      }
    }
    // ------------------------------

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


// 📍 Load Single Project
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
};// ---- ADD TO PROJECT CONTROLLER ----

// Add Note to Project
exports.addProjectNote = async (req, res) => {
  try {
    const { note } = req.body;

    if (!note || !note.text || !note.author) {
      return res.status(400).json({ message: "Note text and author required" });
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: note } },
      { new: true }
    )
      .populate("accountId", "businessName")
      .populate("serviceId", "serviceName")
      .populate("members", "name")
      .populate("createdBy", "name");

    res.json({ success: true, message: "Note added", notes: project.notes });
  } catch (err) {
    console.error("addProjectNote error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Delete Note from Project (index based)
exports.deleteProjectNote = async (req, res) => {
  try {
    const { noteIndex } = req.body;

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    project.notes.splice(noteIndex, 1);
    await project.save();

    res.json({ success: true, message: "Note removed", notes: project.notes });
  } catch (err) {
    console.error("deleteProjectNote error:", err);
    res.status(500).json({ message: err.message });
  }
};
