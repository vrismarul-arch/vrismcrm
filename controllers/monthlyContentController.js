const MonthlyContent = require('../models/ContentPlan');
const BusinessAccount = require('../models/BusinessAccount');
const mongoose = require('mongoose');

// =========================
// GET all monthly content with pagination and filters
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

    // Apply filters
    if (month) {
      query.month = month;
    }
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.businessName = { $regex: search, $options: 'i' };
    }

    // Role-based filtering
    const userRole = req.user?.role || req.user?.userType;
    
    if (userRole === 'Employee') {
      const assignedClients = await BusinessAccount.find({ 
        assignedTo: req.user._id 
      }).select('_id');
      const clientIds = assignedClients.map(c => c._id);
      if (clientIds.length > 0) {
        query.clientId = { $in: clientIds };
      } else {
        // Return empty if no assigned clients
        return res.json({ 
          success: true, 
          data: [], 
          pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } 
        });
      }
    }
    
    if (userRole === 'Client') {
      const businessAccount = await BusinessAccount.findOne({ user: req.user._id });
      if (businessAccount) {
        query.clientId = businessAccount._id;
      } else {
        return res.json({ 
          success: true, 
          data: [], 
          pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } 
        });
      }
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

    const contentWithVirtuals = content.map(item => ({
      ...item.toObject(),
      pendingStatic: item.pendingStatic,
      pendingReels: item.pendingReels,
      totalDelivered: item.totalDelivered,
      totalPlanned: item.totalPlanned,
      completionPercentage: item.completionPercentage,
      weeklyProgress: item.weeklyProgress
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
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// GET content by ID
// =========================
exports.getContentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role || req.user?.userType;

    const content = await MonthlyContent.findById(id)
      .populate('clientId', 'businessName contactName contactEmail contactNumber address billingCycle selectedPlan assignedTo')
      .populate('createdBy', 'name email role')
      .populate('updatedBy', 'name email role')
      .populate('history.updatedBy', 'name email role');

    if (!content) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    // Check permissions
    if (userRole === 'Employee') {
      const client = await BusinessAccount.findById(content.clientId);
      if (!client || client.assignedTo?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
    }

    if (userRole === 'Client') {
      const businessAccount = await BusinessAccount.findOne({ user: req.user._id });
      if (!businessAccount || businessAccount._id.toString() !== content.clientId._id.toString()) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
    }

    const contentWithVirtuals = {
      ...content.toObject(),
      pendingStatic: content.pendingStatic,
      pendingReels: content.pendingReels,
      totalDelivered: content.totalDelivered,
      totalPlanned: content.totalPlanned,
      completionPercentage: content.completionPercentage,
      weeklyProgress: content.weeklyProgress
    };

    res.json({ success: true, data: contentWithVirtuals });
  } catch (error) {
    console.error('Error fetching content by ID:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// GET content by client ID
// =========================
exports.getContentByClientId = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { month } = req.query;
    const userRole = req.user?.role || req.user?.userType;

    // Check permissions
    if (userRole === 'Employee') {
      const client = await BusinessAccount.findById(clientId);
      if (!client || client.assignedTo?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have permission to view this client\'s content' 
        });
      }
    }

    if (userRole === 'Client') {
      const businessAccount = await BusinessAccount.findOne({ user: req.user._id });
      if (!businessAccount || businessAccount._id.toString() !== clientId) {
        return res.status(403).json({ 
          success: false, 
          message: 'You can only view your own content' 
        });
      }
    }

    let query = { clientId };
    if (month) {
      query.month = month;
    }

    const content = await MonthlyContent.find(query)
      .populate('clientId', 'businessName contactName contactEmail contactNumber')
      .populate('updatedBy', 'name email role')
      .sort({ month: -1 });

    const contentWithVirtuals = content.map(item => ({
      ...item.toObject(),
      pendingStatic: item.pendingStatic,
      pendingReels: item.pendingReels,
      totalDelivered: item.totalDelivered,
      totalPlanned: item.totalPlanned,
      completionPercentage: item.completionPercentage,
      weeklyProgress: item.weeklyProgress
    }));

    res.json({ success: true, data: contentWithVirtuals });
  } catch (error) {
    console.error('Error fetching content by client ID:', error);
    res.status(500).json({ success: false, error: error.message });
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
      notes,
      weeks
    } = req.body;

    const userRole = req.user?.role || req.user?.userType;

    // Check permissions
    if (userRole === 'Employee') {
      const client = await BusinessAccount.findById(clientId);
      if (!client || client.assignedTo?.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only create content for clients assigned to you'
        });
      }
    }

    // Validate client exists
    const client = await BusinessAccount.findById(clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // Check for duplicate
    const existingContent = await MonthlyContent.findOne({ clientId, month: targetMonth });
    if (existingContent) {
      return res.status(409).json({
        success: false,
        message: 'Content already exists for this client and month. Use update instead.'
      });
    }

    // Validate delivered counts
    if (deliveredStatic > staticPosts || deliveredReels > reels) {
      return res.status(400).json({
        success: false,
        message: 'Delivered counts cannot exceed total posts'
      });
    }

    // Initialize weeks
    let weeksData = weeks;
    if (!weeksData || weeksData.length === 0) {
      weeksData = [1, 2, 3, 4, 5].map(weekNum => ({
        weekNumber: weekNum,
        staticTarget: Math.ceil(staticPosts / 5),
        staticDelivered: 0,
        reelsTarget: Math.ceil(reels / 5),
        reelsDelivered: 0,
        status: 'pending',
        notes: ''
      }));
      
      // Adjust last week to match exact totals
      if (weeksData.length === 5) {
        const totalStaticTarget = weeksData.reduce((sum, w) => sum + w.staticTarget, 0);
        const totalReelsTarget = weeksData.reduce((sum, w) => sum + w.reelsTarget, 0);
        
        if (totalStaticTarget !== staticPosts) {
          weeksData[4].staticTarget += staticPosts - totalStaticTarget;
        }
        if (totalReelsTarget !== reels) {
          weeksData[4].reelsTarget += reels - totalReelsTarget;
        }
      }
    }

    // Create history entry
    const historyEntry = {
      date: new Date(),
      staticPosts,
      reels,
      deliveredStatic,
      deliveredReels,
      weeks: weeksData,
      updatedBy: req.user._id,
      note: notes || 'Initial creation'
    };

    const newContent = new MonthlyContent({
      clientId,
      businessName: client.businessName,
      month: targetMonth,
      staticPosts,
      reels,
      deliveredStatic,
      deliveredReels,
      weeks: weeksData,
      history: [historyEntry],
      createdBy: req.user._id,
      updatedBy: req.user._id,
      notes,
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
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// UPDATE monthly content
// =========================
exports.updateContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { staticPosts, reels, deliveredStatic, deliveredReels, notes, status } = req.body;
    const userRole = req.user?.role || req.user?.userType;

    const content = await MonthlyContent.findById(id);
    if (!content) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    // Check permissions
    if (userRole === 'Employee') {
      const client = await BusinessAccount.findById(content.clientId);
      if (!client || client.assignedTo?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
    }

    if (userRole === 'Client') {
      const businessAccount = await BusinessAccount.findOne({ user: req.user._id });
      if (!businessAccount || businessAccount._id.toString() !== content.clientId.toString()) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
    }

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

    const hasChanges = newStaticPosts !== content.staticPosts ||
      newReels !== content.reels ||
      newDeliveredStatic !== content.deliveredStatic ||
      newDeliveredReels !== content.deliveredReels;

    if (hasChanges) {
      // Save to history
      content.history.push({
        date: new Date(),
        staticPosts: content.staticPosts,
        reels: content.reels,
        deliveredStatic: content.deliveredStatic,
        deliveredReels: content.deliveredReels,
        weeks: content.weeks,
        updatedBy: req.user._id,
        note: notes || 'Content updated'
      });

      if (staticPosts !== undefined) content.staticPosts = staticPosts;
      if (reels !== undefined) content.reels = reels;
      if (deliveredStatic !== undefined) content.deliveredStatic = deliveredStatic;
      if (deliveredReels !== undefined) content.deliveredReels = deliveredReels;
      if (notes !== undefined) content.notes = notes;
      if (status !== undefined) content.status = status;

      content.updatedBy = req.user._id;
      content.lastUpdated = new Date();
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
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// UPDATE WEEKLY PROGRESS
// =========================
exports.updateWeeklyProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { weeks } = req.body;
    const userRole = req.user?.role || req.user?.userType;

    const content = await MonthlyContent.findById(id);
    if (!content) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    // Check permissions
    if (userRole === 'Employee') {
      const client = await BusinessAccount.findById(content.clientId);
      if (!client || client.assignedTo?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
    }

    if (userRole === 'Client') {
      const businessAccount = await BusinessAccount.findOne({ user: req.user._id });
      if (!businessAccount || businessAccount._id.toString() !== content.clientId.toString()) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
    }

    // Validate weekly data
    for (const week of weeks) {
      if ((week.staticDelivered || 0) > (week.staticTarget || 0) || 
          (week.reelsDelivered || 0) > (week.reelsTarget || 0)) {
        return res.status(400).json({
          success: false,
          message: `Week ${week.weekNumber}: Delivered cannot exceed target`
        });
      }
    }

    // Save to history
    content.history.push({
      date: new Date(),
      staticPosts: content.staticPosts,
      reels: content.reels,
      deliveredStatic: content.deliveredStatic,
      deliveredReels: content.deliveredReels,
      weeks: content.weeks,
      updatedBy: req.user._id,
      note: 'Weekly progress update'
    });

    // Update weeks
    content.weeks = weeks;
    
    // Recalculate monthly totals
    content.recalculateFromWeeks();
    
    content.updatedBy = req.user._id;
    content.lastUpdated = new Date();

    await content.save();

    const updatedContent = await MonthlyContent.findById(id)
      .populate('clientId', 'businessName contactName contactEmail contactNumber')
      .populate('updatedBy', 'name email role');

    res.json({
      success: true,
      message: 'Weekly progress updated successfully',
      data: updatedContent
    });
  } catch (error) {
    console.error('Error updating weekly progress:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// DELETE monthly content
// =========================
exports.deleteContent = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role || req.user?.userType;

    // Only Admin and Superadmin can delete
    const allowedRoles = ['Admin', 'Superadmin', 'admin', 'superadmin'];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete content'
      });
    }

    const content = await MonthlyContent.findByIdAndDelete(id);

    if (!content) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    res.json({ success: true, message: 'Content deleted successfully' });
  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// BULK UPDATE content
// =========================
exports.bulkUpdateContent = async (req, res) => {
  try {
    const { updates } = req.body;
    const userRole = req.user?.role || req.user?.userType;

    const allowedRoles = ['Admin', 'Superadmin', 'admin', 'superadmin', 'Manager', 'Team Leader'];
    if (!allowedRoles.includes(userRole)) {
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

        const newStaticPosts = data.staticPosts ?? content.staticPosts;
        const newReels = data.reels ?? content.reels;
        const newDeliveredStatic = data.deliveredStatic ?? content.deliveredStatic;
        const newDeliveredReels = data.deliveredReels ?? content.deliveredReels;

        if (newDeliveredStatic > newStaticPosts || newDeliveredReels > newReels) {
          errors.push({ id, error: 'Delivered exceeds total' });
          continue;
        }

        content.history.push({
          date: new Date(),
          staticPosts: content.staticPosts,
          reels: content.reels,
          deliveredStatic: content.deliveredStatic,
          deliveredReels: content.deliveredReels,
          updatedBy: req.user._id,
          note: 'Bulk update'
        });

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
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// GET dashboard summary
// =========================
exports.getDashboardSummary = async (req, res) => {
  try {
    const { month } = req.query;
    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const userRole = req.user?.role || req.user?.userType;

    let matchQuery = { month: targetMonth };

    if (userRole === 'Employee') {
      const assignedClients = await BusinessAccount.find({ assignedTo: req.user._id }).select('_id');
      const clientIds = assignedClients.map(c => c._id);
      if (clientIds.length > 0) {
        matchQuery.clientId = { $in: clientIds };
      } else {
        return res.json({ success: true, data: { totalClients: 0 } });
      }
    }

    if (userRole === 'Client') {
      const businessAccount = await BusinessAccount.findOne({ user: req.user._id });
      if (businessAccount) {
        matchQuery.clientId = businessAccount._id;
      } else {
        return res.json({ success: true, data: { totalClients: 0 } });
      }
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
          activeClients: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          completedClients: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
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
          pendingClients: { $subtract: ['$totalClients', { $add: ['$activeClients', '$completedClients'] }] },
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

    res.json({ success: true, data: aggregation[0] || { totalClients: 0 } });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// GET monthly trends
// =========================
exports.getMonthlyTrends = async (req, res) => {
  try {
    const { clientId, months = 6 } = req.query;
    const userRole = req.user?.role || req.user?.userType;

    let matchQuery = {};

    if (clientId) {
      matchQuery.clientId = new mongoose.Types.ObjectId(clientId);
    }

    if (userRole === 'Employee' && !clientId) {
      const assignedClients = await BusinessAccount.find({ assignedTo: req.user._id }).select('_id');
      const clientIds = assignedClients.map(c => c._id);
      if (clientIds.length > 0) {
        matchQuery.clientId = { $in: clientIds };
      } else {
        return res.json({ success: true, data: [] });
      }
    }

    if (userRole === 'Client' && !clientId) {
      const businessAccount = await BusinessAccount.findOne({ user: req.user._id });
      if (businessAccount) {
        matchQuery.clientId = businessAccount._id;
      } else {
        return res.json({ success: true, data: [] });
      }
    }

    const trends = await MonthlyContent.aggregate([
      { $match: matchQuery },
      { $sort: { month: -1 } },
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
                    {
                      $divide: [
                        { $add: ['$deliveredStatic', '$deliveredReels'] },
                        { $add: ['$staticPosts', '$reels'] }
                      ]
                    },
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

    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('Error fetching monthly trends:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// GET weekly summary (like your image table)
// =========================
exports.getWeeklySummary = async (req, res) => {
  try {
    const { month } = req.query;
    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const userRole = req.user?.role || req.user?.userType;

    let query = { month: targetMonth };

    if (userRole === 'Employee') {
      const assignedClients = await BusinessAccount.find({ assignedTo: req.user._id }).select('_id');
      const clientIds = assignedClients.map(c => c._id);
      if (clientIds.length > 0) {
        query.clientId = { $in: clientIds };
      } else {
        return res.json({ success: true, data: { clients: [], totals: {}, month: targetMonth } });
      }
    }

    if (userRole === 'Client') {
      const businessAccount = await BusinessAccount.findOne({ user: req.user._id });
      if (businessAccount) {
        query.clientId = businessAccount._id;
      } else {
        return res.json({ success: true, data: { clients: [], totals: {}, month: targetMonth } });
      }
    }

    const contents = await MonthlyContent.find(query)
      .populate('clientId', 'businessName')
      .sort({ businessName: 1 });

    // Transform data for weekly summary table
    const summaryData = contents.map(content => {
      const weeklyData = {};
      content.weeks.forEach(week => {
        weeklyData[`week${week.weekNumber}`] = {
          staticTarget: week.staticTarget,
          staticDelivered: week.staticDelivered,
          reelsTarget: week.reelsTarget,
          reelsDelivered: week.reelsDelivered,
          status: week.status
        };
      });

      return {
        clientId: content.clientId?._id,
        clientName: content.clientId?.businessName || content.businessName,
        month: content.month,
        monthlyTarget: {
          static: content.staticPosts,
          reels: content.reels
        },
        monthlyDelivered: {
          static: content.deliveredStatic,
          reels: content.deliveredReels
        },
        weeks: weeklyData,
        completionPercentage: content.completionPercentage,
        weeklyProgress: content.weeklyProgress,
        status: content.status
      };
    });

    // Calculate totals row
    const totals = contents.reduce((acc, content) => {
      acc.staticTarget += content.staticPosts || 0;
      acc.staticDelivered += content.deliveredStatic || 0;
      acc.reelsTarget += content.reels || 0;
      acc.reelsDelivered += content.deliveredReels || 0;
      
      content.weeks.forEach(week => {
        acc[`week${week.weekNumber}StaticTarget`] = (acc[`week${week.weekNumber}StaticTarget`] || 0) + (week.staticTarget || 0);
        acc[`week${week.weekNumber}StaticDelivered`] = (acc[`week${week.weekNumber}StaticDelivered`] || 0) + (week.staticDelivered || 0);
        acc[`week${week.weekNumber}ReelsTarget`] = (acc[`week${week.weekNumber}ReelsTarget`] || 0) + (week.reelsTarget || 0);
        acc[`week${week.weekNumber}ReelsDelivered`] = (acc[`week${week.weekNumber}ReelsDelivered`] || 0) + (week.reelsDelivered || 0);
      });
      
      return acc;
    }, {
      staticTarget: 0,
      staticDelivered: 0,
      reelsTarget: 0,
      reelsDelivered: 0,
      clientCount: 0
    });

    totals.clientCount = contents.length;
    totals.completionPercentage = totals.staticTarget + totals.reelsTarget > 0
      ? Math.round(((totals.staticDelivered + totals.reelsDelivered) / (totals.staticTarget + totals.reelsTarget)) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        clients: summaryData,
        totals,
        month: targetMonth
      }
    });
  } catch (error) {
    console.error('Error fetching weekly summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// GET stats for specific client
// =========================
exports.getClientStats = async (req, res) => {
  try {
    const { clientId } = req.params;
    const userRole = req.user?.role || req.user?.userType;

    // Check permissions
    if (userRole === 'Employee') {
      const client = await BusinessAccount.findById(clientId);
      if (!client || client.assignedTo?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
    }

    if (userRole === 'Client') {
      const businessAccount = await BusinessAccount.findOne({ user: req.user._id });
      if (!businessAccount || businessAccount._id.toString() !== clientId) {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
    }

    const stats = await MonthlyContent.aggregate([
      { $match: { clientId: new mongoose.Types.ObjectId(clientId) } },
      {
        $group: {
          _id: null,
          totalStaticPosts: { $sum: '$staticPosts' },
          totalReels: { $sum: '$reels' },
          totalDeliveredStatic: { $sum: '$deliveredStatic' },
          totalDeliveredReels: { $sum: '$deliveredReels' },
          monthsCount: { $sum: 1 },
          averageCompletion: { $avg: '$completionPercentage' }
        }
      }
    ]);

    res.json({ success: true, data: stats[0] || {} });
  } catch (error) {
    console.error('Error fetching client stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};