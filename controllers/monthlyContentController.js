const MonthlyContent = require('../models/ContentPlan');
const BusinessAccount = require('../models/BusinessAccount');
const mongoose = require('mongoose');

// =========================
// UPDATE WEEKLY PROGRESS - Main function
// =========================
exports.updateWeeklyProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { weeks } = req.body;
    const userRole = req.user?.role || req.user?.userType;

    console.log('Updating weekly progress for ID:', id);
    console.log('Received weeks data:', JSON.stringify(weeks, null, 2));

    const content = await MonthlyContent.findById(id);
    if (!content) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    // Permission checks
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

    // Validate delivered cannot exceed target
    for (const week of weeks) {
      if ((week.staticDelivered || 0) > (week.staticTarget || 0)) {
        return res.status(400).json({ 
          success: false, 
          message: `Week ${week.weekNumber}: Static delivered (${week.staticDelivered}) cannot exceed target (${week.staticTarget})` 
        });
      }
      if ((week.reelsDelivered || 0) > (week.reelsTarget || 0)) {
        return res.status(400).json({ 
          success: false, 
          message: `Week ${week.weekNumber}: Reels delivered (${week.reelsDelivered}) cannot exceed target (${week.reelsTarget})` 
        });
      }
    }

    // Save current state to history
    content.history.push({
      date: new Date(),
      staticPosts: content.staticPosts,
      reels: content.reels,
      deliveredStatic: content.deliveredStatic,
      deliveredReels: content.deliveredReels,
      weeks: JSON.parse(JSON.stringify(content.weeks)),
      updatedBy: req.user._id,
      note: 'Weekly progress update'
    });

    // Update weeks
    content.weeks = weeks;
    
    // CRITICAL: This automatically updates monthly totals from weeks
    content.updateFromWeeks();
    
    content.updatedBy = req.user._id;
    content.lastUpdated = new Date();

    await content.save();

    console.log('After update - Monthly totals:', {
      staticPosts: content.staticPosts,
      deliveredStatic: content.deliveredStatic,
      reels: content.reels,
      deliveredReels: content.deliveredReels,
      completionPercentage: content.completionPercentage
    });

    // Return updated content
    const updatedContent = await MonthlyContent.findById(id)
      .populate('clientId', 'businessName')
      .populate('updatedBy', 'name email role');

    res.json({
      success: true,
      message: 'Weekly progress updated successfully. Monthly totals auto-calculated.',
      data: {
        ...updatedContent.toObject(),
        pendingStatic: updatedContent.pendingStatic,
        pendingReels: updatedContent.pendingReels,
        totalDelivered: updatedContent.totalDelivered,
        totalPlanned: updatedContent.totalPlanned,
        completionPercentage: updatedContent.completionPercentage,
        weeklyProgress: updatedContent.weeklyProgress
      }
    });
  } catch (error) {
    console.error('Error updating weekly progress:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// GET weekly summary
// =========================
exports.getWeeklySummary = async (req, res) => {
  try {
    const { month } = req.query;
    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const userRole = req.user?.role || req.user?.userType;

    console.log('Fetching weekly summary for month:', targetMonth);

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

    console.log(`Found ${contents.length} content records`);

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
        monthlyTarget: { static: content.staticPosts, reels: content.reels },
        monthlyDelivered: { static: content.deliveredStatic, reels: content.deliveredReels },
        weeks: weeklyData,
        completionPercentage: content.completionPercentage,
        weeklyProgress: content.weeklyProgress,
        status: content.status
      };
    });

    // Calculate totals
    const totals = contents.reduce((acc, content) => {
      acc.staticTarget += content.staticPosts || 0;
      acc.staticDelivered += content.deliveredStatic || 0;
      acc.reelsTarget += content.reels || 0;
      acc.reelsDelivered += content.deliveredReels || 0;
      acc.clientCount += 1;
      
      // Week-wise totals
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
// GET content by ID
// =========================
exports.getContentById = async (req, res) => {
  try {
    const { id } = req.params;
    const content = await MonthlyContent.findById(id)
      .populate('clientId', 'businessName')
      .populate('createdBy', 'name email role')
      .populate('updatedBy', 'name email role');

    if (!content) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    res.json({
      success: true,
      data: {
        ...content.toObject(),
        pendingStatic: content.pendingStatic,
        pendingReels: content.pendingReels,
        totalDelivered: content.totalDelivered,
        totalPlanned: content.totalPlanned,
        completionPercentage: content.completionPercentage,
        weeklyProgress: content.weeklyProgress
      }
    });
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// CREATE content
// =========================
exports.createContent = async (req, res) => {
  try {
    const { clientId, staticPosts = 0, reels = 0, month, notes } = req.body;
    const userRole = req.user?.role || req.user?.userType;

    const client = await BusinessAccount.findById(clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    
    const existing = await MonthlyContent.findOne({ clientId, month: targetMonth });
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        message: 'Content already exists for this client and month' 
      });
    }

    // Create weeks with distributed targets
    const weeks = [1, 2, 3, 4, 5].map((weekNum, index) => ({
      weekNumber: weekNum,
      staticTarget: Math.ceil(staticPosts / 5),
      staticDelivered: 0,
      reelsTarget: Math.ceil(reels / 5),
      reelsDelivered: 0,
      status: 'pending',
      notes: ''
    }));

    // Adjust last week to match exact totals
    const totalStaticTarget = weeks.reduce((sum, w) => sum + w.staticTarget, 0);
    const totalReelsTarget = weeks.reduce((sum, w) => sum + w.reelsTarget, 0);
    
    if (totalStaticTarget !== staticPosts) {
      weeks[4].staticTarget += staticPosts - totalStaticTarget;
    }
    if (totalReelsTarget !== reels) {
      weeks[4].reelsTarget += reels - totalReelsTarget;
    }

    const newContent = new MonthlyContent({
      clientId,
      businessName: client.businessName,
      month: targetMonth,
      staticPosts,
      reels,
      deliveredStatic: 0,
      deliveredReels: 0,
      weeks,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      notes,
      status: 'pending'
    });

    await newContent.save();

    const populatedContent = await MonthlyContent.findById(newContent._id)
      .populate('clientId', 'businessName');

    res.status(201).json({ 
      success: true, 
      message: 'Content created successfully', 
      data: populatedContent 
    });
  } catch (error) {
    console.error('Error creating content:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// UPDATE content
// =========================
exports.updateContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { staticPosts, reels, deliveredStatic, deliveredReels, notes, status } = req.body;
    
    const content = await MonthlyContent.findById(id);
    if (!content) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    if (staticPosts !== undefined) content.staticPosts = staticPosts;
    if (reels !== undefined) content.reels = reels;
    if (deliveredStatic !== undefined) content.deliveredStatic = deliveredStatic;
    if (deliveredReels !== undefined) content.deliveredReels = deliveredReels;
    if (notes !== undefined) content.notes = notes;
    if (status !== undefined) content.status = status;

    content.updatedBy = req.user._id;
    await content.save();
    
    res.json({ 
      success: true, 
      message: 'Content updated successfully', 
      data: content 
    });
  } catch (error) {
    console.error('Error updating content:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// DELETE content
// =========================
exports.deleteContent = async (req, res) => {
  try {
    const { id } = req.params;
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
// GET all content
// =========================
exports.getAllContent = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, month, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);
    let query = {};
    
    if (month) query.month = month;
    if (status && status !== 'all') query.status = status;
    if (search) query.businessName = { $regex: search, $options: 'i' };
    
    const userRole = req.user?.role || req.user?.userType;
    
    if (userRole === 'Client') {
      const businessAccount = await BusinessAccount.findOne({ user: req.user._id });
      if (businessAccount) {
        query.clientId = businessAccount._id;
      } else {
        return res.json({ success: true, data: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } });
      }
    }
    
    if (userRole === 'Employee') {
      const assignedClients = await BusinessAccount.find({ assignedTo: req.user._id }).select('_id');
      const clientIds = assignedClients.map(c => c._id);
      if (clientIds.length > 0) {
        query.clientId = { $in: clientIds };
      } else {
        return res.json({ success: true, data: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } });
      }
    }
    
    const total = await MonthlyContent.countDocuments(query);
    const content = await MonthlyContent.find(query)
      .populate('clientId', 'businessName')
      .sort({ month: -1, businessName: 1 })
      .skip(skip)
      .limit(limit);
    
    const contentWithVirtuals = content.map(item => ({
      ...item.toObject(),
      pendingStatic: item.pendingStatic,
      pendingReels: item.pendingReels,
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
    console.error('Error fetching all content:', error);
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
    
    const contents = await MonthlyContent.find({ month: targetMonth });
    
    const totals = contents.reduce((acc, c) => ({
      totalClients: acc.totalClients + 1,
      totalStaticPosts: acc.totalStaticPosts + (c.staticPosts || 0),
      totalReels: acc.totalReels + (c.reels || 0),
      totalDeliveredStatic: acc.totalDeliveredStatic + (c.deliveredStatic || 0),
      totalDeliveredReels: acc.totalDeliveredReels + (c.deliveredReels || 0),
      completedClients: acc.completedClients + (c.status === 'completed' ? 1 : 0),
      activeClients: acc.activeClients + (c.status === 'active' ? 1 : 0)
    }), { 
      totalClients: 0, 
      totalStaticPosts: 0, 
      totalReels: 0, 
      totalDeliveredStatic: 0, 
      totalDeliveredReels: 0,
      completedClients: 0,
      activeClients: 0
    });
    
    const totalPlanned = totals.totalStaticPosts + totals.totalReels;
    const totalDelivered = totals.totalDeliveredStatic + totals.totalDeliveredReels;
    const completionRate = totalPlanned > 0 ? Math.round((totalDelivered / totalPlanned) * 100) : 0;
    
    res.json({ 
      success: true, 
      data: { 
        ...totals, 
        totalPlanned,
        totalDelivered,
        completionRate,
        pendingClients: totals.totalClients - totals.completedClients - totals.activeClients
      } 
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
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
    let query = { clientId };
    if (month) query.month = month;
    
    const content = await MonthlyContent.find(query)
      .populate('clientId', 'businessName')
      .sort({ month: -1 });
    
    res.json({ success: true, data: content });
  } catch (error) {
    console.error('Error fetching content by client ID:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// =========================
// GET client stats
// =========================
exports.getClientStats = async (req, res) => {
  try {
    const { clientId } = req.params;
    const contents = await MonthlyContent.find({ clientId });
    
    const stats = contents.reduce((acc, c) => ({
      totalStaticPosts: acc.totalStaticPosts + (c.staticPosts || 0),
      totalReels: acc.totalReels + (c.reels || 0),
      totalDeliveredStatic: acc.totalDeliveredStatic + (c.deliveredStatic || 0),
      totalDeliveredReels: acc.totalDeliveredReels + (c.deliveredReels || 0),
      monthsCount: contents.length,
      averageCompletion: acc.averageCompletion + (c.completionPercentage || 0)
    }), { 
      totalStaticPosts: 0, 
      totalReels: 0, 
      totalDeliveredStatic: 0, 
      totalDeliveredReels: 0, 
      monthsCount: 0,
      averageCompletion: 0
    });
    
    if (stats.monthsCount > 0) {
      stats.averageCompletion = Math.round(stats.averageCompletion / stats.monthsCount);
    }
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching client stats:', error);
    res.status(500).json({ success: false, error: error.message });
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
      matchQuery.clientId = new mongoose.Types.ObjectId(clientId);
    }
    
    const trends = await MonthlyContent.aggregate([
      { $match: matchQuery },
      { $group: {
          _id: '$month',
          totalStaticPosts: { $sum: '$staticPosts' },
          totalReels: { $sum: '$reels' },
          totalDeliveredStatic: { $sum: '$deliveredStatic' },
          totalDeliveredReels: { $sum: '$deliveredReels' },
          clientCount: { $sum: 1 }
        }
      },
      { $addFields: {
          totalPlanned: { $add: ['$totalStaticPosts', '$totalReels'] },
          totalDelivered: { $add: ['$totalDeliveredStatic', '$totalDeliveredReels'] }
        }
      },
      { $addFields: {
          completionRate: {
            $cond: [
              { $eq: ['$totalPlanned', 0] },
              0,
              { $multiply: [{ $divide: ['$totalDelivered', '$totalPlanned'] }, 100] }
            ]
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
// BULK update content
// =========================
exports.bulkUpdateContent = async (req, res) => {
  try {
    const { updates } = req.body;
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
        
        if (data.staticPosts !== undefined) content.staticPosts = data.staticPosts;
        if (data.reels !== undefined) content.reels = data.reels;
        if (data.deliveredStatic !== undefined) content.deliveredStatic = data.deliveredStatic;
        if (data.deliveredReels !== undefined) content.deliveredReels = data.deliveredReels;
        
        content.updatedBy = req.user._id;
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