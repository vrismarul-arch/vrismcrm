const mongoose = require("mongoose");
const Task = require("../models/Task");
const { sendAlert } = require("./alertController");

/* ================= POPULATE CONFIG ================= */
const populationFields = [
  { path: "assignedTo", select: "name email role profileImage" },
  { path: "assignedBy", select: "name email role profileImage" },
  { path: "accountId", select: "businessName contactName email phone gst" },
  { 
    path: "serviceId", 
    select: "serviceName category basePrice accountId description",
    populate: { path: "accountId", select: "businessName" }
  },
  {
    path: "reasonHistory.addedBy",
    select: "name email role profileImage"
  },
  { path: "monthlyClientId", select: "businessName staticPosts deliveredStatic reels deliveredReels clientId" }
];

/* ================= HELPER FUNCTION TO SAFELY CONVERT ID ================= */
const safeObjectId = (id, defaultValue = null) => {
  if (!id || id === 'null' || id === 'undefined' || id === '') return defaultValue;
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (err) {
    return defaultValue;
  }
};

/* ================= HELPER FUNCTION TO SAFELY CONVERT ID ARRAY ================= */
const safeObjectIdArray = (ids) => {
  if (!Array.isArray(ids)) return [];
  return ids
    .filter(id => id && id !== 'null' && id !== 'undefined' && id !== '')
    .map(id => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(id => id !== null);
};

/* ================= GET TASKS ================= */
exports.getTasks = async (req, res) => {
  try {
    console.log("📥 Fetching tasks with params:", req.query);

    const {
      assignedTo,
      assignedBy,
      status,
      accountId,
      serviceId,
      monthlyClientId,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 100,
      isImportant
    } = req.query;

    const filter = {};

    // Handle assignedTo
    if (assignedTo && assignedTo !== 'undefined' && assignedTo !== 'null' && assignedTo !== '') {
      const assignedToId = safeObjectId(assignedTo);
      if (assignedToId) {
        filter.assignedTo = { $in: [assignedToId] };
      }
    }

    // Handle assignedBy
    if (assignedBy && assignedBy !== 'undefined' && assignedBy !== 'null' && assignedBy !== '') {
      const assignedById = safeObjectId(assignedBy);
      if (assignedById) {
        filter.assignedBy = assignedById;
      }
    }

    // Handle status
    if (status && status !== 'undefined' && status !== 'null' && status !== '') {
      filter.status = status;
    }
    
    // Handle accountId
    if (accountId && accountId !== 'undefined' && accountId !== 'null' && accountId !== '') {
      const accountObjectId = safeObjectId(accountId);
      if (accountObjectId) {
        filter.accountId = accountObjectId;
      }
    }
    
    // Handle serviceId
    if (serviceId && serviceId !== 'undefined' && serviceId !== 'null' && serviceId !== '') {
      const serviceObjectId = safeObjectId(serviceId);
      if (serviceObjectId) {
        filter.serviceId = serviceObjectId;
      }
    }
    
    // Handle monthlyClientId
    if (monthlyClientId && monthlyClientId !== 'undefined' && monthlyClientId !== 'null' && monthlyClientId !== '') {
      const monthlyClientObjectId = safeObjectId(monthlyClientId);
      if (monthlyClientObjectId) {
        filter.monthlyClientId = monthlyClientObjectId;
      }
    }

    // Handle isImportant
    if (isImportant === 'true' || isImportant === 'false') {
      filter.isImportant = isImportant === 'true';
    }

    // Handle search
    if (search && search !== 'undefined' && search !== 'null' && search !== '') {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
        { "reasonHistory.text": { $regex: search, $options: "i" } },
        { timeRequired: { $regex: search, $options: "i" } }
      ];
    }

    // Handle date range
    if (startDate || endDate) {
      filter.assignedDate = {};
      if (startDate && startDate !== 'undefined' && startDate !== 'null' && startDate !== '') {
        filter.assignedDate.$gte = new Date(startDate);
      }
      if (endDate && endDate !== 'undefined' && endDate !== 'null' && endDate !== '') {
        filter.assignedDate.$lte = new Date(endDate);
      }
    }

    console.log("🔍 Final filter:", JSON.stringify(filter, null, 2));

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tasks = await Task.find(filter)
      .populate(populationFields)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Task.countDocuments(filter);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      tasks
    });
  } catch (err) {
    console.error("❌ getTasks error:", {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    res.status(500).json({ 
      success: false,
      message: "Error fetching tasks.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/* ================= GET SINGLE TASK ================= */
exports.getTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid task ID format" 
      });
    }

    const task = await Task.findById(id).populate(populationFields);
    
    if (!task) {
      return res.status(404).json({ 
        success: false,
        message: "Task not found." 
      });
    }

    res.json({
      success: true,
      task
    });
  } catch (err) {
    console.error("❌ getTask error:", err);
    res.status(500).json({ 
      success: false,
      message: "Error fetching task." 
    });
  }
};

/* ================= CREATE TASK ================= */
exports.createTask = async (req, res) => {
  try {
    console.log("📝 Creating task with data:", req.body);

    const taskData = { ...req.body };

    // Handle assignedTo array
    if (taskData.assignedTo) {
      taskData.assignedTo = safeObjectIdArray(taskData.assignedTo);
    } else {
      taskData.assignedTo = [];
    }

    // Handle assignedBy
    if (taskData.assignedBy) {
      taskData.assignedBy = safeObjectId(taskData.assignedBy, req.user?._id);
    } else if (req.user?._id) {
      taskData.assignedBy = safeObjectId(req.user._id);
    }

    if (!taskData.assignedBy) {
      return res.status(400).json({ 
        success: false,
        message: "assignedBy is required" 
      });
    }

    // Handle accountId
    taskData.accountId = safeObjectId(taskData.accountId);

    // Handle serviceId
    taskData.serviceId = safeObjectId(taskData.serviceId);

    // Handle monthlyClientId
    taskData.monthlyClientId = safeObjectId(taskData.monthlyClientId);

    // Ensure dates are valid
    if (taskData.dueDate && taskData.dueDate !== 'null' && taskData.dueDate !== 'undefined') {
      taskData.dueDate = new Date(taskData.dueDate);
    } else {
      delete taskData.dueDate;
    }

    if (taskData.assignedDate && taskData.assignedDate !== 'null' && taskData.assignedDate !== 'undefined') {
      taskData.assignedDate = new Date(taskData.assignedDate);
    } else {
      taskData.assignedDate = new Date();
    }

    // Create task
    const task = new Task(taskData);
    await task.save();

    // Populate for response
    const populated = await Task.findById(task._id).populate(populationFields);

    // Send alerts to assigned users
    if (Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
      for (const userId of task.assignedTo) {
        try {
          await sendAlert({
            userId,
            message: `New task assigned: ${task.title || "Untitled Task"}`,
            type: "Task",
            refId: task._id
          });
        } catch (alertErr) {
          console.warn("⚠️ Failed to send alert:", alertErr.message);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      task: populated
    });
  } catch (err) {
    console.error("❌ createTask error:", err);
    res.status(400).json({
      success: false,
      message: "Error creating task",
      error: err.message
    });
  }
};

/* ================= UPDATE TASK ================= */
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid task ID format" 
      });
    }

    const oldTask = await Task.findById(id);
    if (!oldTask) {
      return res.status(404).json({ 
        success: false,
        message: "Task not found." 
      });
    }

    const updateData = { ...req.body };

    // Handle assignedTo array
    if (updateData.assignedTo !== undefined) {
      updateData.assignedTo = safeObjectIdArray(updateData.assignedTo);
    }

    // Handle assignedBy
    if (updateData.assignedBy !== undefined) {
      updateData.assignedBy = safeObjectId(updateData.assignedBy, oldTask.assignedBy);
    }

    // Handle accountId
    if (updateData.accountId !== undefined) {
      updateData.accountId = safeObjectId(updateData.accountId, oldTask.accountId);
    }

    // Handle serviceId
    if (updateData.serviceId !== undefined) {
      updateData.serviceId = safeObjectId(updateData.serviceId, oldTask.serviceId);
    }

    // Handle monthlyClientId
    if (updateData.monthlyClientId !== undefined) {
      updateData.monthlyClientId = safeObjectId(updateData.monthlyClientId, oldTask.monthlyClientId);
    }

    // Handle dates
    if (updateData.dueDate) {
      if (updateData.dueDate === 'null' || updateData.dueDate === 'undefined' || updateData.dueDate === '') {
        updateData.dueDate = null;
      } else {
        updateData.dueDate = new Date(updateData.dueDate);
      }
    }

    // Remove undefined fields
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    console.log("📝 Updating task with data:", updateData);

    const updated = await Task.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate(populationFields);

    res.json({
      success: true,
      message: "Task updated successfully",
      task: updated
    });
  } catch (err) {
    console.error("❌ updateTask error:", err);
    res.status(400).json({
      success: false,
      message: "Error updating task.",
      error: err.message
    });
  }
};

/* ================= ADD TASK NOTE ================= */
exports.addTaskNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, addedBy } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ 
        success: false,
        message: "Note text is required" 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid task ID format" 
      });
    }

    let userId = addedBy;
    if (!userId && req.user) {
      userId = req.user._id;
    }

    const noteData = {
      text: text.trim(),
      addedBy: safeObjectId(userId),
      createdAt: new Date()
    };

    const task = await Task.findByIdAndUpdate(
      id,
      { $push: { reasonHistory: noteData } },
      { new: true }
    ).populate(populationFields);

    if (!task) {
      return res.status(404).json({ 
        success: false,
        message: "Task not found." 
      });
    }

    res.json({
      success: true,
      message: "Note added successfully",
      task
    });
  } catch (err) {
    console.error("❌ addTaskNote error:", err);
    res.status(500).json({ 
      success: false,
      message: "Error adding note." 
    });
  }
};

/* ================= DELETE TASK ================= */
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid task ID format" 
      });
    }

    const task = await Task.findByIdAndDelete(id);
    
    if (!task) {
      return res.status(404).json({ 
        success: false,
        message: "Task not found." 
      });
    }

    res.json({ 
      success: true,
      message: "Task deleted successfully." 
    });
  } catch (err) {
    console.error("❌ deleteTask error:", err);
    res.status(500).json({ 
      success: false,
      message: "Error deleting task." 
    });
  }
};

/* ================= GET TASKS BY ACCOUNT ================= */
exports.getTasksByAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    
    if (!accountId) {
      return res.status(400).json({ 
        success: false,
        message: "Account ID required" 
      });
    }

    const accountObjectId = safeObjectId(accountId);
    if (!accountObjectId) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid account ID format" 
      });
    }

    const tasks = await Task.find({ 
      $or: [
        { accountId: accountObjectId },
        { "serviceId.accountId": accountObjectId }
      ]
    })
      .populate(populationFields)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      tasks
    });
  } catch (err) {
    console.error("❌ getTasksByAccount error:", err);
    res.status(500).json({ 
      success: false,
      message: "Error fetching tasks by account" 
    });
  }
};

/* ================= GET TASKS BY SERVICE ================= */
exports.getTasksByService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    
    if (!serviceId) {
      return res.status(400).json({ 
        success: false,
        message: "Service ID required" 
      });
    }

    const serviceObjectId = safeObjectId(serviceId);
    if (!serviceObjectId) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid service ID format" 
      });
    }

    const tasks = await Task.find({ serviceId: serviceObjectId })
      .populate(populationFields)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      tasks
    });
  } catch (err) {
    console.error("❌ getTasksByService error:", err);
    res.status(500).json({ 
      success: false,
      message: "Error fetching tasks by service" 
    });
  }
};

/* ================= BULK UPDATE TASKS ================= */
exports.bulkUpdateTasks = async (req, res) => {
  try {
    const { taskIds, updateData } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "Task IDs array required" 
      });
    }

    // Convert string IDs to ObjectIds safely
    const objectIds = taskIds
      .map(id => safeObjectId(id))
      .filter(id => id !== null);

    if (objectIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "No valid task IDs provided" 
      });
    }

    // Process update data
    const processedUpdate = { ...updateData };
    
    // Handle special fields
    if (processedUpdate.status) {
      processedUpdate.status = processedUpdate.status;
    }
    
    if (processedUpdate.isImportant !== undefined) {
      processedUpdate.isImportant = processedUpdate.isImportant === 'true' || processedUpdate.isImportant === true;
    }

    if (processedUpdate.accountId) {
      processedUpdate.accountId = safeObjectId(processedUpdate.accountId);
    }
    
    if (processedUpdate.serviceId) {
      processedUpdate.serviceId = safeObjectId(processedUpdate.serviceId);
    }

    const result = await Task.updateMany(
      { _id: { $in: objectIds } },
      { $set: processedUpdate },
      { runValidators: true }
    );

    res.json({
      success: true,
      message: "Tasks updated successfully",
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    });
  } catch (err) {
    console.error("❌ bulkUpdateTasks error:", err);
    res.status(500).json({ 
      success: false,
      message: "Error bulk updating tasks" 
    });
  }
};

/* ================= GET TASK STATISTICS ================= */
exports.getTaskStatistics = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;

    const filter = {};

    if (userId && userId !== 'undefined' && userId !== 'null') {
      const userObjectId = safeObjectId(userId);
      if (userObjectId) {
        filter.assignedTo = { $in: [userObjectId] };
      }
    }

    if (startDate || endDate) {
      filter.assignedDate = {};
      if (startDate && startDate !== 'undefined' && startDate !== 'null') {
        filter.assignedDate.$gte = new Date(startDate);
      }
      if (endDate && endDate !== 'undefined' && endDate !== 'null') {
        filter.assignedDate.$lte = new Date(endDate);
      }
    }

    const stats = await Task.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] }
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] }
          },
          todo: {
            $sum: { $cond: [{ $eq: ["$status", "To Do"] }, 1, 0] }
          },
          review: {
            $sum: { $cond: [{ $eq: ["$status", "Review"] }, 1, 0] }
          },
          important: {
            $sum: { $cond: [{ $eq: ["$isImportant", true] }, 1, 0] }
          }
        }
      }
    ]);

    const overdue = await Task.countDocuments({
      ...filter,
      dueDate: { $lt: new Date() },
      status: { $ne: "Completed" }
    });

    const result = stats[0] || {
      total: 0,
      completed: 0,
      inProgress: 0,
      todo: 0,
      review: 0,
      important: 0
    };

    res.json({
      success: true,
      statistics: {
        ...result,
        overdue
      }
    });
  } catch (err) {
    console.error("❌ getTaskStatistics error:", err);
    res.status(500).json({ 
      success: false,
      message: "Error fetching task statistics" 
    });
  }
};