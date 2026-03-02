// controllers/monthlyContentController.js
const MonthlyContent = require('../models/MonthlyContent');
const BusinessAccount = require('../models/BusinessAccount');
const mongoose = require('mongoose');

// Helper function to check user role
const hasRole = (user, allowedRoles) => {
  return allowedRoles.includes(user.role);
};

// =========================
// GET all monthly content with pagination
// =========================
exports.getAllContent = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      month,
      status,
      search,
      sortBy = 'lastUpdated',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    let query = {};

    // Filter by month (YYYY-MM format)
    if (month) {
      query.month = month;
    }

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Search by business name
    if (search) {
      query.businessName = { $regex: search, $options: 'i' };
    }

    // If user is employee, only show their assigned clients
    if (req.user.role === 'Employee') {
      // First get clients assigned to this employee
      const assignedClients = await BusinessAccount.find({ 
        assignedTo: req.user._id 
      }).select('_id');
      
      const clientIds = assignedClients.map(c => c._id);
      query.clientId = { $in: clientIds };
    }

    const total = await MonthlyContent.countDocuments(query);

    const content = await MonthlyContent.find(query)
      .populate('clientId', 'businessName contactName contactEmail contactNumber assignedTo')
      .populate('createdBy', 'name email role')
      .populate('updatedBy', 'name email role')
      .populate('history.updatedBy', 'name email role')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit);

    // Add virtual fields to response
    const contentWithVirtuals = content.map(item => ({
      ...item.toObject(),
      pendingStatic: item.pendingStatic,
      pendingReels: item.pendingReels,
      totalDelivered: item.totalDelivered,
      totalPlanned: item.totalPlanned,
      completionPercentage: item.completionPercentage
    }));

    res.json({
      success: true,
      data: contentWithVirtuals,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching monthly content:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// =========================
// GET content by ID
// =========================
exports.getContentById = async (req, res) => {
  try {
    const { id } = req.params;

    const content = await MonthlyContent.findById(id)
      .populate('clientId', 'businessName contactName contactEmail contactNumber address billingCycle selectedPlan assignedTo')
      .populate('createdBy', 'name email role')
      .populate('updatedBy', 'name email role')
      .populate('history.updatedBy', 'name email role');

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    // Check if employee has access to this client
    if (req.user.role === 'Employee') {
      const client = await BusinessAccount.findById(content.clientId);
      if (!client || client.assignedTo?.toString() !== req.user._id) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this content'
        });
      }
    }

    // Add virtual fields
    const contentWithVirtuals = {
      ...content.toObject(),
      pendingStatic: content.pendingStatic,
      pendingReels: content.pendingReels,
      totalDelivered: content.totalDelivered,
      totalPlanned: content.totalPlanned,
      completionPercentage: content.completionPercentage
    };

    res.json({
      success: true,
      data: contentWithVirtuals
    });
  } catch (error) {
    console.error('Error fetching content by ID:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// =========================
// GET content by client ID
// =========================
exports.getContentByClientId = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { month } = req.query;

    // Check if employee has access to this client
    if (req.user.role === 'Employee') {
      const client = await BusinessAccount.findById(clientId);
      if (!client || client.assignedTo?.toString() !== req.user._id) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this client\'s content'
        });
      }
    }

    let query = { clientId };

    // If month specified, get that specific month
    if (month) {
      query.month = month;
    }

    const content = await MonthlyContent.find(query)
      .populate('clientId', 'businessName contactName contactEmail contactNumber')
      .populate('updatedBy', 'name email role')
      .sort({ month: -1 });

    // Add virtual fields
    const contentWithVirtuals = content.map(item => ({
      ...item.toObject(),
      pendingStatic: item.pendingStatic,
      pendingReels: item.pendingReels,
      totalDelivered: item.totalDelivered,
      totalPlanned: item.totalPlanned,
      completionPercentage: item.completionPercentage
    }));

    res.json({
      success: true,
      data: contentWithVirtuals
    });
  } catch (error) {
    console.error('Error fetching content by client ID:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// =========================
// CREATE new monthly content
// =========================
exports.createContent = async (req, res) => {
  try {
    const {
      clientId,
      staticPosts = 0,
      reels = 0,
      deliveredStatic = 0,
      deliveredReels = 0,
      month,
      note
    } = req.body;

    // Check permissions (Admin, Manager can create for anyone, Employee only for assigned)
    if (req.user.role === 'Employee') {
      const client = await BusinessAccount.findById(clientId);
      if (!client || client.assignedTo?.toString() !== req.user._id) {
        return res.status(403).json({
          success: false,
          message: 'You can only create content for clients assigned to you'
        });
      }
    }

    // Validate client exists
    const client = await BusinessAccount.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Check if content already exists for this client and month
    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    
    const existingContent = await MonthlyContent.findOne({
      clientId,
      month: targetMonth
    });

    if (existingContent) {
      return res.status(409).json({
        success: false,
        message: 'Content already exists for this client and month. Use update instead.'
      });
    }

    // Validate delivered counts don't exceed total
    if (deliveredStatic > staticPosts || deliveredReels > reels) {
      return res.status(400).json({
        success: false,
        message: 'Delivered counts cannot exceed total posts'
      });
    }

    // Create history entry
    const historyEntry = {
      date: new Date(),
      staticPosts,
      reels,
      deliveredStatic,
      deliveredReels,
      updatedBy: req.user._id,
      note: note || 'Initial creation'
    };

    const newContent = new MonthlyContent({
      clientId,
      businessName: client.businessName,
      month: targetMonth,
      staticPosts,
      reels,
      deliveredStatic,
      deliveredReels,
      history: [historyEntry],
      createdBy: req.user._id,
      updatedBy: req.user._id,
      status: deliveredStatic + deliveredReels === staticPosts + reels ? 'completed' : 'active'
    });

    await newContent.save();

    const populatedContent = await MonthlyContent.findById(newContent._id)
      .populate('clientId', 'businessName contactName contactEmail contactNumber')
      .populate('createdBy', 'name email role')
      .populate('updatedBy', 'name email role');

    res.status(201).json({
      success: true,
      message: 'Monthly content created successfully',
      data: populatedContent
    });
  } catch (error) {
    console.error('Error creating monthly content:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// =========================
// UPDATE monthly content
// =========================
exports.updateContent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      staticPosts,
      reels,
      deliveredStatic,
      deliveredReels,
      note
    } = req.body;

    const content = await MonthlyContent.findById(id);
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    // Check permissions
    if (req.user.role === 'Employee') {
      const client = await BusinessAccount.findById(content.clientId);
      if (!client || client.assignedTo?.toString() !== req.user._id) {
        return res.status(403).json({
          success: false,
          message: 'You can only update content for clients assigned to you'
        });
      }
    }

    // Validate delivered counts
    const newStaticPosts = staticPosts ?? content.staticPosts;
    const newReels = reels ?? content.reels;
    const newDeliveredStatic = deliveredStatic ?? content.deliveredStatic;
    const newDeliveredReels = deliveredReels ?? content.deliveredReels;

    if (newDeliveredStatic > newStaticPosts || newDeliveredReels > newReels) {
      return res.status(400).json({
        success: false,
        message: 'Delivered counts cannot exceed total posts'
      });
    }

    // Check if anything changed
    const hasChanges = 
      newStaticPosts !== content.staticPosts ||
      newReels !== content.reels ||
      newDeliveredStatic !== content.deliveredStatic ||
      newDeliveredReels !== content.deliveredReels;

    if (hasChanges) {
      // Add to history
      content.history.push({
        date: new Date(),
        staticPosts: content.staticPosts,
        reels: content.reels,
        deliveredStatic: content.deliveredStatic,
        deliveredReels: content.deliveredReels,
        updatedBy: req.user._id,
        note: note || 'Content updated'
      });

      // Update fields
      if (staticPosts !== undefined) content.staticPosts = staticPosts;
      if (reels !== undefined) content.reels = reels;
      if (deliveredStatic !== undefined) content.deliveredStatic = deliveredStatic;
      if (deliveredReels !== undefined) content.deliveredReels = deliveredReels;
      
      content.updatedBy = req.user._id;
      content.lastUpdated = new Date();
      
      // Update status based on completion
      const totalDelivered = content.deliveredStatic + content.deliveredReels;
      const totalPlanned = content.staticPosts + content.reels;
      
      if (totalDelivered === totalPlanned) {
        content.status = 'completed';
      } else if (totalDelivered > 0) {
        content.status = 'active';
      } else {
        content.status = 'pending';
      }
    }

    await content.save();

    const updatedContent = await MonthlyContent.findById(id)
      .populate('clientId', 'businessName contactName contactEmail contactNumber')
      .populate('updatedBy', 'name email role')
      .populate('history.updatedBy', 'name email role');

    res.json({
      success: true,
      message: 'Content updated successfully',
      data: updatedContent
    });
  } catch (error) {
    console.error('Error updating monthly content:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// =========================
// DELETE monthly content (Admin only)
// =========================
exports.deleteContent = async (req, res) => {
  try {
    const { id } = req.params;

    // Only Admin can delete
    if (req.user.role !== 'admin' && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete content'
      });
    }

    const content = await MonthlyContent.findByIdAndDelete(id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      message: 'Content deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// =========================
// BULK UPDATE monthly content (Admin/Manager only)
// =========================
exports.bulkUpdateContent = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { id, staticPosts, reels, deliveredStatic, deliveredReels }

    // Only Admin and Manager can do bulk updates
    if (req.user.role !== 'admin' && req.user.role !== 'Admin' && req.user.role !== 'Manager') {
      return res.status(403).json({
        success: false,
        message: 'Only admins and managers can perform bulk updates'
      });
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { id, ...data } = update;
        
        const content = await MonthlyContent.findById(id);
        if (!content) {
          errors.push({ id, error: 'Content not found' });
          continue;
        }

        // Validate
        const newStaticPosts = data.staticPosts ?? content.staticPosts;
        const newReels = data.reels ?? content.reels;
        const newDeliveredStatic = data.deliveredStatic ?? content.deliveredStatic;
        const newDeliveredReels = data.deliveredReels ?? content.deliveredReels;

        if (newDeliveredStatic > newStaticPosts || newDeliveredReels > newReels) {
          errors.push({ id, error: 'Delivered exceeds total' });
          continue;
        }

        // Add to history
        content.history.push({
          date: new Date(),
          staticPosts: content.staticPosts,
          reels: content.reels,
          deliveredStatic: content.deliveredStatic,
          deliveredReels: content.deliveredReels,
          updatedBy: req.user._id,
          note: 'Bulk update'
        });

        // Update
        if (data.staticPosts !== undefined) content.staticPosts = data.staticPosts;
        if (data.reels !== undefined) content.reels = data.reels;
        if (data.deliveredStatic !== undefined) content.deliveredStatic = data.deliveredStatic;
        if (data.deliveredReels !== undefined) content.deliveredReels = data.deliveredReels;

        content.updatedBy = req.user._id;
        content.lastUpdated = new Date();

        await content.save();
        results.push(content);
      } catch (error) {
        errors.push({ id: update.id, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Updated ${results.length} items, ${errors.length} failed`,
      data: { results, errors }
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// =========================
// GET dashboard summary
// =========================
exports.getDashboardSummary = async (req, res) => {
  try {
    const { month } = req.query;
    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    let matchQuery = { month: targetMonth };

    // If employee, only show their assigned clients
    if (req.user.role === 'Employee') {
      const assignedClients = await BusinessAccount.find({ 
        assignedTo: req.user._id 
      }).select('_id');
      
      const clientIds = assignedClients.map(c => c._id);
      matchQuery.clientId = { $in: clientIds };
    }

    const aggregation = await MonthlyContent.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalClients: { $sum: 1 },
          totalStaticPosts: { $sum: '$staticPosts' },
          totalReels: { $sum: '$reels' },
          totalDeliveredStatic: { $sum: '$deliveredStatic' },
          totalDeliveredReels: { $sum: '$deliveredReels' },
          totalPlanned: { $sum: { $add: ['$staticPosts', '$reels'] } },
          totalDelivered: { $sum: { $add: ['$deliveredStatic', '$deliveredReels'] } },
          activeClients: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'active'] },
                1,
                0
              ]
            }
          },
          completedClients: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'completed'] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalClients: 1,
          totalStaticPosts: 1,
          totalReels: 1,
          totalDeliveredStatic: 1,
          totalDeliveredReels: 1,
          totalPlanned: 1,
          totalDelivered: 1,
          activeClients: 1,
          completedClients: 1,
          pendingClients: {
            $subtract: ['$totalClients', { $add: ['$activeClients', '$completedClients'] }]
          },
          pendingStatic: { $subtract: ['$totalStaticPosts', '$totalDeliveredStatic'] },
          pendingReels: { $subtract: ['$totalReels', '$totalDeliveredReels'] },
          completionRate: {
            $cond: [
              { $eq: ['$totalPlanned', 0] },
              0,
              { $multiply: [{ $divide: ['$totalDelivered', '$totalPlanned'] }, 100] }
            ]
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: aggregation[0] || {
        totalClients: 0,
        totalStaticPosts: 0,
        totalReels: 0,
        totalDeliveredStatic: 0,
        totalDeliveredReels: 0,
        totalPlanned: 0,
        totalDelivered: 0,
        activeClients: 0,
        completedClients: 0,
        pendingClients: 0,
        pendingStatic: 0,
        pendingReels: 0,
        completionRate: 0
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// =========================
// GET monthly trends
// =========================
exports.getMonthlyTrends = async (req, res) => {
  try {
    const { clientId, months = 6 } = req.query;

    let matchQuery = {};
    
    if (clientId) {
      matchQuery.clientId = mongoose.Types.ObjectId(clientId);
    }

    // If employee, only show their assigned clients
    if (req.user.role === 'Employee' && !clientId) {
      const assignedClients = await BusinessAccount.find({ 
        assignedTo: req.user._id 
      }).select('_id');
      
      const clientIds = assignedClients.map(c => c._id);
      matchQuery.clientId = { $in: clientIds };
    }

    const trends = await MonthlyContent.aggregate([
      { $match: matchQuery },
      {
        $sort: { month: -1 }
      },
      {
        $group: {
          _id: '$month',
          totalStaticPosts: { $sum: '$staticPosts' },
          totalReels: { $sum: '$reels' },
          totalDeliveredStatic: { $sum: '$deliveredStatic' },
          totalDeliveredReels: { $sum: '$deliveredReels' },
          clientCount: { $sum: 1 },
          completionRate: {
            $avg: {
              $cond: [
                { $eq: [{ $add: ['$staticPosts', '$reels'] }, 0] },
                0,
                {
                  $multiply: [
                    { $divide: [{ $add: ['$deliveredStatic', '$deliveredReels'] }, { $add: ['$staticPosts', '$reels'] }] },
                    100
                  ]
                }
              ]
            }
          }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: parseInt(months) }
    ]);

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Error fetching monthly trends:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};