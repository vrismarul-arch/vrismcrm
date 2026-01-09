const Task = require("../models/Task");
const { sendAlert } = require("./alertController");

// ================= POPULATE CONFIG =================
const populationFields = [
  { path: "assignedTo", select: "name email role profileImage" },
  { path: "assignedBy", select: "name email role profileImage" },
  { path: "accountId", select: "businessName contactName" },
  { path: "serviceId", select: "serviceName category basePrice accountId" },
  { path: "reasonHistory.addedBy", select: "name email role profileImage" }
];

// ================= GET TASKS =================
exports.getTasks = async (req, res) => {
  try {
    const {
      assignedTo,
      assignedBy,
      status,
      accountId,
      serviceId,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 100
    } = req.query;

    const filter = {};

    if (assignedTo) filter.assignedTo = { $in: [assignedTo] };
    if (assignedBy) filter.assignedBy = assignedBy;
    if (status) filter.status = status;
    if (accountId) filter.accountId = { $in: [accountId] };
    if (serviceId) filter.serviceId = { $in: [serviceId] };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
        { "reasonHistory.text": { $regex: search, $options: "i" } },
        { timeRequired: { $regex: search, $options: "i" } }
      ];
    }

    if (startDate || endDate) {
      filter.assignedDate = {};
      if (startDate) filter.assignedDate.$gte = new Date(startDate);
      if (endDate) filter.assignedDate.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const tasks = await Task.find(filter)
      .populate(populationFields)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Task.countDocuments(filter);

    res.json({ total, page: Number(page), limit: Number(limit), tasks });
  } catch (err) {
    console.error("getTasks error:", err);
    res.status(500).json({ message: "Error fetching tasks." });
  }
};

// ================= GET SINGLE TASK =================
exports.getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate(populationFields);
    if (!task) return res.status(404).json({ message: "Task not found." });
    res.json(task);
  } catch (err) {
    console.error("getTask error:", err);
    res.status(500).json({ message: "Error fetching task." });
  }
};

// ================= CREATE TASK =================
exports.createTask = async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();

    const populated = await Task.findById(task._id).populate(populationFields);

    if (Array.isArray(task.assignedTo)) {
      for (const userId of task.assignedTo) {
        await sendAlert({
          userId,
          message: `New task assigned: ${task.title || "Untitled Task"}`,
          type: "Task",
          refId: task._id
        });
      }
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error("createTask error:", err);
    res.status(400).json({
      message: "Error creating task",
      error: err.message
    });
  }
};

// ================= UPDATE TASK =================
exports.updateTask = async (req, res) => {
  try {
    if (!req.body.assignedBy) {
      const old = await Task.findById(req.params.id);
      if (old) req.body.assignedBy = old.assignedBy;
    }

    if (!req.body.attachments || req.body.attachments.length === 0) {
      delete req.body.attachments;
    }

    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate(populationFields);

    if (!updated) {
      return res.status(404).json({ message: "Task not found." });
    }

    if (Array.isArray(updated.assignedTo)) {
      for (const userId of updated.assignedTo) {
        await sendAlert({
          userId,
          message: `Task updated: ${updated.title || "Untitled Task"}`,
          type: "Task",
          refId: updated._id
        });
      }
    }

    res.json(updated);
  } catch (err) {
    console.error("updateTask error:", err);
    res.status(400).json({
      message: "Error updating task",
      error: err.message
    });
  }
};

// ================= ADD NOTE (FIXED, NO req.user) =================
exports.addTaskNote = async (req, res) => {
  try {
    const { text, addedBy } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Note text required" });
    }

    let userId = addedBy;

    if (!userId) {
      const oldTask = await Task.findById(req.params.id).select("assignedBy");
      if (!oldTask) {
        return res.status(404).json({ message: "Task not found." });
      }
      userId = oldTask.assignedBy;
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          reasonHistory: {
            text,
            addedBy: userId
          }
        }
      },
      { new: true }
    ).populate(populationFields);

    res.json(task);
  } catch (err) {
    console.error("addTaskNote error:", err);
    res.status(500).json({ message: "Error adding note." });
  }
};

// ================= DELETE TASK =================
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }
    res.json({ message: "Task deleted." });
  } catch (err) {
    console.error("deleteTask error:", err);
    res.status(500).json({ message: "Error deleting task." });
  }
};
