const mongoose = require("mongoose"); // 🔥 IMPORTANT FIX
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

/* ================= GET TASKS ================= */
exports.getTasks = async (req, res) => {
  try {
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
      limit = 100
    } = req.query;

    const filter = {};

    if (assignedTo) filter.assignedTo = { $in: [assignedTo] };
    if (assignedBy) filter.assignedBy = assignedBy;
    if (status) filter.status = status;
    
    // Handle accountId as ObjectId or string
    if (accountId) {
      try {
        filter.accountId = new mongoose.Types.ObjectId(accountId);
      } catch {
        filter.accountId = accountId;
      }
    }
    
    // Handle serviceId as ObjectId or string
    if (serviceId) {
      try {
        filter.serviceId = new mongoose.Types.ObjectId(serviceId);
      } catch {
        filter.serviceId = serviceId;
      }
    }
    
    // Handle monthlyClientId as ObjectId or string
    if (monthlyClientId) {
      try {
        filter.monthlyClientId = new mongoose.Types.ObjectId(monthlyClientId);
      } catch {
        filter.monthlyClientId = monthlyClientId;
      }
    }

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
      if (startDate)
        filter.assignedDate.$gte = new Date(startDate);
      if (endDate)
        filter.assignedDate.$lte = new Date(endDate);
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
      tasks
    });
  } catch (err) {
    console.error("getTasks error:", err);
    res.status(500).json({ message: "Error fetching tasks." });
  }
};

/* ================= GET SINGLE TASK ================= */
exports.getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate(
      populationFields
    );
    if (!task)
      return res.status(404).json({ message: "Task not found." });
    res.json(task);
  } catch (err) {
    console.error("getTask error:", err);
    res.status(500).json({ message: "Error fetching task." });
  }
};

/* ================= CREATE TASK ================= */
exports.createTask = async (req, res) => {
  try {
    // Handle assignedTo conversion
    if (req.body.assignedTo) {
      req.body.assignedTo = Array.isArray(req.body.assignedTo)
        ? req.body.assignedTo.map(
            (id) => new mongoose.Types.ObjectId(id)
          )
        : [new mongoose.Types.ObjectId(req.body.assignedTo)];
    }

    // Handle accountId conversion
    if (req.body.accountId && req.body.accountId !== 'null' && req.body.accountId !== 'undefined') {
      try {
        req.body.accountId = new mongoose.Types.ObjectId(req.body.accountId);
      } catch (err) {
        console.warn("Invalid accountId format:", req.body.accountId);
        req.body.accountId = null;
      }
    } else {
      req.body.accountId = null;
    }

    // Handle serviceId conversion
    if (req.body.serviceId && req.body.serviceId !== 'null' && req.body.serviceId !== 'undefined') {
      try {
        req.body.serviceId = new mongoose.Types.ObjectId(req.body.serviceId);
      } catch (err) {
        console.warn("Invalid serviceId format:", req.body.serviceId);
        req.body.serviceId = null;
      }
    } else {
      req.body.serviceId = null;
    }

    // Handle monthlyClientId conversion
    if (req.body.monthlyClientId && req.body.monthlyClientId !== 'null' && req.body.monthlyClientId !== 'undefined') {
      try {
        req.body.monthlyClientId = new mongoose.Types.ObjectId(req.body.monthlyClientId);
      } catch (err) {
        console.warn("Invalid monthlyClientId format:", req.body.monthlyClientId);
        req.body.monthlyClientId = null;
      }
    } else {
      req.body.monthlyClientId = null;
    }

    // Ensure assignedBy is set
    if (!req.body.assignedBy) {
      return res.status(400).json({ message: "assignedBy is required" });
    }

    // Create task with processed data
    const taskData = {
      ...req.body,
      assignedBy: new mongoose.Types.ObjectId(req.body.assignedBy)
    };

    const task = new Task(taskData);
    await task.save();

    const populated = await Task.findById(task._id).populate(
      populationFields
    );

    // Send alerts to assigned users
    if (Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
      for (const userId of task.assignedTo) {
        await sendAlert({
          userId,
          message: `New task assigned: ${
            task.title || "Untitled Task"
          }`,
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

/* ================= UPDATE TASK (🔥 FIXED WITH ACCOUNT & SERVICE) ================= */
exports.updateTask = async (req, res) => {
  try {
    const oldTask = await Task.findById(req.params.id);
    if (!oldTask) {
      return res.status(404).json({ message: "Task not found." });
    }

    const updateData = { ...req.body };

    /* ===== assignedBy safety ===== */
    if (!updateData.assignedBy) {
      updateData.assignedBy = oldTask.assignedBy;
    } else {
      try {
        updateData.assignedBy = new mongoose.Types.ObjectId(updateData.assignedBy);
      } catch {
        updateData.assignedBy = oldTask.assignedBy;
      }
    }

    /* ===== attachments safety ===== */
    if (
      !Array.isArray(updateData.attachments) ||
      updateData.attachments.length === 0
    ) {
      delete updateData.attachments;
    }

    /* ===== assignedTo FIX ===== */
    if (updateData.assignedTo !== undefined) {
      if (Array.isArray(updateData.assignedTo) && updateData.assignedTo.length > 0) {
        updateData.assignedTo = updateData.assignedTo
          .filter(id => id && id !== 'null' && id !== 'undefined')
          .map(id => {
            try {
              return new mongoose.Types.ObjectId(id);
            } catch {
              return null;
            }
          })
          .filter(id => id !== null);
      } else {
        updateData.assignedTo = [];
      }
    }

    /* ===== accountId FIX ===== */
    if (updateData.accountId !== undefined) {
      if (updateData.accountId && updateData.accountId !== 'null' && updateData.accountId !== 'undefined') {
        try {
          updateData.accountId = new mongoose.Types.ObjectId(updateData.accountId);
        } catch (err) {
          console.warn("Invalid accountId format in update:", updateData.accountId);
          updateData.accountId = null;
        }
      } else {
        updateData.accountId = null;
      }
    }

    /* ===== serviceId FIX ===== */
    if (updateData.serviceId !== undefined) {
      if (updateData.serviceId && updateData.serviceId !== 'null' && updateData.serviceId !== 'undefined') {
        try {
          updateData.serviceId = new mongoose.Types.ObjectId(updateData.serviceId);
        } catch (err) {
          console.warn("Invalid serviceId format in update:", updateData.serviceId);
          updateData.serviceId = null;
        }
      } else {
        updateData.serviceId = null;
      }
    }

    /* ===== monthlyClientId FIX ===== */
    if (updateData.monthlyClientId !== undefined) {
      if (updateData.monthlyClientId && updateData.monthlyClientId !== 'null' && updateData.monthlyClientId !== 'undefined') {
        try {
          updateData.monthlyClientId = new mongoose.Types.ObjectId(updateData.monthlyClientId);
        } catch (err) {
          console.warn("Invalid monthlyClientId format in update:", updateData.monthlyClientId);
          updateData.monthlyClientId = null;
        }
      } else {
        updateData.monthlyClientId = null;
      }
    }

    // Log the update data for debugging
    console.log("Updating task with data:", JSON.stringify(updateData, null, 2));

    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).populate(populationFields);

    // Send alerts to assigned users
    if (Array.isArray(updated.assignedTo) && updated.assignedTo.length > 0) {
      for (const user of updated.assignedTo) {
        await sendAlert({
          userId: user._id || user,
          message: `Task updated: ${
            updated.title || "Untitled Task"
          }`,
          type: "Task",
          refId: updated._id
        });
      }
    }

    res.json(updated);
  } catch (err) {
    console.error("updateTask error:", err);
    res.status(400).json({
      message: "Error updating task.",
      error: err.message
    });
  }
};

/* ================= ADD TASK NOTE ================= */
exports.addTaskNote = async (req, res) => {
  try {
    const { text, addedBy } = req.body;

    if (!text || !text.trim()) {
      return res
        .status(400)
        .json({ message: "Note text required" });
    }

    let userId = addedBy;

    if (!userId) {
      const oldTask = await Task.findById(req.params.id).select(
        "assignedBy"
      );
      if (!oldTask)
        return res
          .status(404)
          .json({ message: "Task not found." });
      userId = oldTask.assignedBy;
    }

    // Convert userId to ObjectId if it's a string
    try {
      userId = new mongoose.Types.ObjectId(userId);
    } catch {
      // Keep as is if conversion fails
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          reasonHistory: {
            text,
            addedBy: userId,
            createdAt: new Date()
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

/* ================= DELETE TASK ================= */
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

/* ================= GET TASKS BY ACCOUNT ================= */
exports.getTasksByAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    
    if (!accountId) {
      return res.status(400).json({ message: "Account ID required" });
    }

    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(accountId);
    } catch {
      return res.status(400).json({ message: "Invalid account ID format" });
    }

    const tasks = await Task.find({ 
      $or: [
        { accountId: objectId },
        { "serviceId.accountId": objectId }
      ]
    })
      .populate(populationFields)
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    console.error("getTasksByAccount error:", err);
    res.status(500).json({ message: "Error fetching tasks by account" });
  }
};

/* ================= GET TASKS BY SERVICE ================= */
exports.getTasksByService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    
    if (!serviceId) {
      return res.status(400).json({ message: "Service ID required" });
    }

    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(serviceId);
    } catch {
      return res.status(400).json({ message: "Invalid service ID format" });
    }

    const tasks = await Task.find({ serviceId: objectId })
      .populate(populationFields)
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    console.error("getTasksByService error:", err);
    res.status(500).json({ message: "Error fetching tasks by service" });
  }
};

/* ================= BULK UPDATE TASKS ================= */
exports.bulkUpdateTasks = async (req, res) => {
  try {
    const { taskIds, updateData } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ message: "Task IDs array required" });
    }

    // Convert string IDs to ObjectIds
    const objectIds = taskIds
      .map(id => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter(id => id !== null);

    if (objectIds.length === 0) {
      return res.status(400).json({ message: "No valid task IDs provided" });
    }

    // Process update data similar to updateTask
    const processedUpdate = { ...updateData };
    
    // Handle special fields if present
    if (processedUpdate.accountId) {
      try {
        processedUpdate.accountId = new mongoose.Types.ObjectId(processedUpdate.accountId);
      } catch {
        delete processedUpdate.accountId;
      }
    }
    
    if (processedUpdate.serviceId) {
      try {
        processedUpdate.serviceId = new mongoose.Types.ObjectId(processedUpdate.serviceId);
      } catch {
        delete processedUpdate.serviceId;
      }
    }

    const result = await Task.updateMany(
      { _id: { $in: objectIds } },
      { $set: processedUpdate },
      { runValidators: true }
    );

    res.json({
      message: "Tasks updated successfully",
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    });
  } catch (err) {
    console.error("bulkUpdateTasks error:", err);
    res.status(500).json({ message: "Error bulk updating tasks" });
  }
};  