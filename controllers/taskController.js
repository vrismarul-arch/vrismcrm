// controllers/taskController.js
const Task = require("../models/Task");
const { sendAlert } = require("./alertController");

const populationFields = [
  { path: "assignedTo", select: "name email role" },
  { path: "assignedBy", select: "name email role" },
  { path: "accountId", select: "businessName contactName" },
  { path: "serviceId", select: "serviceName category basePrice accountId" },
];

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
      limit = 100,
    } = req.query;

    const filter = {};

    if (assignedTo) filter.assignedTo = assignedTo;
    if (assignedBy) filter.assignedBy = assignedBy;
    if (status) filter.status = status;
    if (accountId) filter.accountId = accountId;
    if (serviceId) filter.serviceId = serviceId;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
        { timeRequired: { $regex: search, $options: "i" } },
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

    res.json({
      total,
      page: Number(page),
      limit: Number(limit),
      tasks,
    });
  } catch (err) {
    console.error("getTasks error:", err);
    res.status(500).json({ message: "Error fetching tasks." });
  }
};

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

exports.createTask = async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();

    const populated = await Task.findById(task._id).populate(populationFields);

    // 🔔 Alert for assigned user
    if (task.assignedTo) {
      await sendAlert({
        userId: task.assignedTo,
        message: `New task assigned: ${task.title || "Untitled Task"}`,
        type: "Task",
        refId: task._id,
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error("createTask error:", err);
    res.status(400).json({
      message: "Error creating task.",
      error: err.message,
    });
  }
};

exports.updateTask = async (req, res) => {
  try {
    if (!req.body.assignedBy) {
      const old = await Task.findById(req.params.id);
      if (old) req.body.assignedBy = old.assignedBy;
    }

    const updated = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate(populationFields);

    if (!updated)
      return res.status(404).json({ message: "Task not found." });

    // 🔔 Alert: task updated
    if (updated.assignedTo) {
      await sendAlert({
        userId: updated.assignedTo,
        message: `Task updated: ${updated.title || "Untitled Task"}`,
        type: "Task",
        refId: updated._id,
      });
    }

    res.json(updated);
  } catch (err) {
    console.error("updateTask error:", err);
    res.status(400).json({
      message: "Error updating task.",
      error: err.message,
    });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found." });

    // Optional alert here if needed
    res.json({ message: "Task deleted." });
  } catch (err) {
    console.error("deleteTask error:", err);
    res.status(500).json({ message: "Error deleting task." });
  }
};
