const Task = require("../models/Task");

// Helper function for population fields
const populationFields = [
    { path: "assignedTo", select: "name email role" },
    { path: "accountId", select: "businessName contactName" },
    { path: "serviceId", select: "serviceName category basePrice" }
];

// Get all tasks (optionally filter by accountId or assignedTo)
exports.getTasks = async (req, res) => {
  try {
    const { accountId, assignedTo } = req.query;
    const filter = {};
    if (accountId) filter.accountId = accountId;
    if (assignedTo) filter.assignedTo = assignedTo;

    const tasks = await Task.find(filter).populate(populationFields);
    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching tasks." });
  }
};

// Get single task
exports.getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate(populationFields);

    if (!task) return res.status(404).json({ message: "Task not found." });
    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching task." });
  }
};

// Create task
exports.createTask = async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();
    const populatedTask = await Task.findById(task._id).populate(populationFields);
    res.status(201).json(populatedTask);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Error creating task.", error: error.message });
  }
};

// Update task
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate(populationFields);
  
    if (!task) return res.status(404).json({ message: "Task not found." });
    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Error updating task.", error: error.message });
  }
};

// Delete task
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found." });
    res.json({ message: "Task deleted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting task." });
  }
};