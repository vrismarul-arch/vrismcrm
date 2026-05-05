const mongoose = require('mongoose');
const WeeklyReport = require('../models/WeeklyReport');

// @desc    Get all reports with filters (with services)
// @route   GET /api/reports
// @access  Public
const getAllReports = async (req, res) => {
  try {
    const { businessAccount, month, year } = req.query;
    let filter = {};
    
    if (businessAccount) filter.businessAccount = businessAccount;
    if (month) filter.month = month;
    if (year) filter.year = parseInt(year);
    
    const reports = await WeeklyReport.find(filter)
      .populate('businessAccount', 'businessName email phone')
      .populate('createdBy', 'name email')
      .populate('services', 'serviceName isActive gstRate')
      .sort({ year: -1, month: -1, createdAt: -1 });
    
    const reportsWithSummary = reports.map(report => {
      const reportObj = report.toObject();
      return {
        ...reportObj,
        serviceDetails: report.serviceDetails ? Object.fromEntries(report.serviceDetails) : {},
        summary: {
          totalTarget: (report.totalStaticTarget || 0) + (report.totalReelsTarget || 0),
          totalCompleted: (report.totalStaticCompleted || 0) + (report.totalReelsCompleted || 0),
          progressPercentage: report.overallProgress || 0,
          weeksCompleted: report.weeks?.filter(w => w.weekProgress === 100).length || 0,
          totalWeeks: report.weeks?.length || 0
        }
      };
    });
    
    res.status(200).json({
      success: true,
      count: reports.length,
      data: reportsWithSummary
    });
  } catch (error) {
    console.error('Error in getAllReports:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get single report by ID (with services)
// @route   GET /api/reports/:id
// @access  Public
const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }
    
    const report = await WeeklyReport.findById(id)
      .populate('businessAccount', 'businessName email phone address')
      .populate('createdBy', 'name email')
      .populate('services', 'serviceName isActive gstRate plans features');
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    const reportObj = report.toObject();
    reportObj.serviceDetails = report.serviceDetails ? Object.fromEntries(report.serviceDetails) : {};
    
    const monthlySummary = {
      totalStaticTarget: report.totalStaticTarget || 0,
      totalReelsTarget: report.totalReelsTarget || 0,
      totalStaticCompleted: report.totalStaticCompleted || 0,
      totalReelsCompleted: report.totalReelsCompleted || 0,
      overallProgress: report.overallProgress || 0,
      services: report.services,
      serviceDetails: reportObj.serviceDetails,
      weeksData: report.weeks?.map(week => ({
        weekNumber: week.weekNumber,
        staticTarget: week.staticTarget || 0,
        reelsTarget: week.reelsTarget || 0,
        staticCompleted: week.staticCompleted || 0,
        reelsCompleted: week.reelsCompleted || 0,
        weekProgress: week.weekProgress || 0,
        postsCount: week.posts?.length || 0
      })) || []
    };
    
    res.status(200).json({
      success: true,
      data: reportObj,
      summary: monthlySummary
    });
  } catch (error) {
    console.error('Error in getReportById:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Create or update weekly report (with services)
// @route   POST /api/reports
// @access  Public
const createOrUpdateReport = async (req, res) => {
  try {
    const { 
      businessAccount, 
      month, 
      year, 
      weeks, 
      services,
      serviceDetails,
      createdBy 
    } = req.body;
    
    if (!businessAccount || !month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Please provide businessAccount, month, and year'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(businessAccount)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid business account ID'
      });
    }
    
    let report = await WeeklyReport.findOne({ businessAccount, month, year });
    
    if (report) {
      // Update existing report
      if (weeks) report.weeks = weeks;
      if (services) report.services = services;
      
      // Handle serviceDetails as Map
      if (serviceDetails) {
        const detailsMap = new Map();
        Object.entries(serviceDetails).forEach(([key, value]) => {
          detailsMap.set(key, value);
        });
        report.serviceDetails = detailsMap;
      }
      
      await report.save();
      
      await report.populate('businessAccount', 'businessName');
      await report.populate('createdBy', 'name email');
      await report.populate('services', 'serviceName isActive gstRate');
      
      const reportObj = report.toObject();
      reportObj.serviceDetails = report.serviceDetails ? Object.fromEntries(report.serviceDetails) : {};
      
      return res.status(200).json({
        success: true,
        message: 'Report updated successfully',
        data: reportObj,
        summary: {
          totalTarget: (report.totalStaticTarget || 0) + (report.totalReelsTarget || 0),
          totalCompleted: (report.totalStaticCompleted || 0) + (report.totalReelsCompleted || 0),
          progress: report.overallProgress || 0
        }
      });
    } else {
      // Create new report
      const detailsMap = new Map();
      if (serviceDetails) {
        Object.entries(serviceDetails).forEach(([key, value]) => {
          detailsMap.set(key, value);
        });
      }
      
      report = new WeeklyReport({
        businessAccount,
        month,
        year,
        weeks: weeks || [],
        services: services || [],
        serviceDetails: detailsMap,
        createdBy: createdBy || req.user?._id
      });
      
      await report.save();
      
      await report.populate('businessAccount', 'businessName');
      await report.populate('createdBy', 'name email');
      await report.populate('services', 'serviceName isActive gstRate');
      
      const reportObj = report.toObject();
      reportObj.serviceDetails = report.serviceDetails ? Object.fromEntries(report.serviceDetails) : {};
      
      return res.status(201).json({
        success: true,
        message: 'Report created successfully',
        data: reportObj,
        summary: {
          totalTarget: (report.totalStaticTarget || 0) + (report.totalReelsTarget || 0),
          totalCompleted: (report.totalStaticCompleted || 0) + (report.totalReelsCompleted || 0),
          progress: report.overallProgress || 0
        }
      });
    }
  } catch (error) {
    console.error('Error in createOrUpdateReport:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Update report services only
// @route   PUT /api/reports/:id/services
// @access  Public
const updateReportServices = async (req, res) => {
  try {
    const { id } = req.params;
    const { services, serviceDetails } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }
    
    const report = await WeeklyReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    if (services !== undefined) {
      report.services = services;
    }
    
    if (serviceDetails) {
      const detailsMap = new Map();
      Object.entries(serviceDetails).forEach(([key, value]) => {
        detailsMap.set(key, value);
      });
      report.serviceDetails = detailsMap;
    }
    
    await report.save();
    
    await report.populate('services', 'serviceName isActive gstRate');
    
    const reportObj = report.toObject();
    reportObj.serviceDetails = report.serviceDetails ? Object.fromEntries(report.serviceDetails) : {};
    
    res.status(200).json({
      success: true,
      message: 'Service details updated successfully',
      data: reportObj
    });
    
  } catch (error) {
    console.error('Error in updateReportServices:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Update specific week in report
// @route   PUT /api/reports/:id/week/:weekNumber
// @access  Public
const updateWeek = async (req, res) => {
  try {
    const { id, weekNumber } = req.params;
    const { staticTarget, reelsTarget, posts, weekStartDate, weekEndDate } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }
    
    const report = await WeeklyReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    const weekIndex = report.weeks.findIndex(w => w.weekNumber === parseInt(weekNumber));
    
    if (weekIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Week not found'
      });
    }
    
    if (staticTarget !== undefined) report.weeks[weekIndex].staticTarget = staticTarget;
    if (reelsTarget !== undefined) report.weeks[weekIndex].reelsTarget = reelsTarget;
    if (posts !== undefined) report.weeks[weekIndex].posts = posts;
    if (weekStartDate !== undefined) report.weeks[weekIndex].weekStartDate = weekStartDate;
    if (weekEndDate !== undefined) report.weeks[weekIndex].weekEndDate = weekEndDate;
    
    report.calculateTotals();
    report.calculateCompleted();
    report.calculateProgress();
    await report.save();
    
    res.status(200).json({
      success: true,
      message: 'Week updated successfully',
      data: report
    });
  } catch (error) {
    console.error('Error in updateWeek:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Add post to a week
// @route   POST /api/reports/:id/week/:weekNumber/posts
// @access  Public
const addPostToWeek = async (req, res) => {
  try {
    const { id, weekNumber } = req.params;
    const { title, instagramLink, postedDate, notes, type } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Post title is required'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }
    
    const report = await WeeklyReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    const weekIndex = report.weeks.findIndex(w => w.weekNumber === parseInt(weekNumber));
    
    if (weekIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Week not found'
      });
    }
    
    const newPost = {
      title,
      instagramLink: instagramLink || '',
      postedDate: postedDate ? new Date(postedDate) : new Date(),
      notes: notes || '',
      type: type || 'static'
    };
    
    report.weeks[weekIndex].posts.push(newPost);
    
    report.calculateTotals();
    report.calculateCompleted();
    report.calculateProgress();
    await report.save();
    
    res.status(201).json({
      success: true,
      message: 'Post added successfully',
      data: report
    });
  } catch (error) {
    console.error('Error in addPostToWeek:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Update post in week
// @route   PUT /api/reports/:id/week/:weekNumber/posts/:postIndex
// @access  Public
const updatePostInWeek = async (req, res) => {
  try {
    const { id, weekNumber, postIndex } = req.params;
    const { title, instagramLink, postedDate, notes, type } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }
    
    const report = await WeeklyReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    const weekIndex = report.weeks.findIndex(w => w.weekNumber === parseInt(weekNumber));
    
    if (weekIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Week not found'
      });
    }
    
    const post = report.weeks[weekIndex].posts[parseInt(postIndex)];
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    
    if (title) post.title = title;
    if (instagramLink !== undefined) post.instagramLink = instagramLink;
    if (postedDate) post.postedDate = new Date(postedDate);
    if (notes !== undefined) post.notes = notes;
    if (type) post.type = type;
    
    report.calculateTotals();
    report.calculateCompleted();
    report.calculateProgress();
    await report.save();
    
    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      data: report
    });
  } catch (error) {
    console.error('Error in updatePostInWeek:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Delete post from week
// @route   DELETE /api/reports/:id/week/:weekNumber/posts/:postIndex
// @access  Public
const deletePostFromWeek = async (req, res) => {
  try {
    const { id, weekNumber, postIndex } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }
    
    const report = await WeeklyReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    const weekIndex = report.weeks.findIndex(w => w.weekNumber === parseInt(weekNumber));
    
    if (weekIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Week not found'
      });
    }
    
    report.weeks[weekIndex].posts.splice(parseInt(postIndex), 1);
    
    report.calculateTotals();
    report.calculateCompleted();
    report.calculateProgress();
    await report.save();
    
    res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
      data: report
    });
  } catch (error) {
    console.error('Error in deletePostFromWeek:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Delete entire report
// @route   DELETE /api/reports/:id
// @access  Public
const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }
    
    const report = await WeeklyReport.findByIdAndDelete(id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Report deleted successfully',
      data: report
    });
  } catch (error) {
    console.error('Error in deleteReport:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get reports by business account (with services)
// @route   GET /api/reports/business/:businessAccountId
// @access  Public
const getReportsByBusinessAccount = async (req, res) => {
  try {
    const { businessAccountId } = req.params;
    const { year } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(businessAccountId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid business account ID'
      });
    }
    
    let filter = { businessAccount: businessAccountId };
    if (year) filter.year = parseInt(year);
    
    const reports = await WeeklyReport.find(filter)
      .populate('createdBy', 'name email')
      .populate('services', 'serviceName isActive gstRate')
      .sort({ year: -1, month: -1 });
    
    const reportsWithServices = reports.map(report => {
      const reportObj = report.toObject();
      return {
        ...reportObj,
        serviceDetails: report.serviceDetails ? Object.fromEntries(report.serviceDetails) : {}
      };
    });
    
    res.status(200).json({
      success: true,
      count: reports.length,
      data: reportsWithServices
    });
  } catch (error) {
    console.error('Error in getReportsByBusinessAccount:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get monthly summary for business account
// @route   GET /api/reports/summary/business/:businessAccountId
// @access  Public
const getBusinessMonthlySummary = async (req, res) => {
  try {
    const { businessAccountId } = req.params;
    const { year } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(businessAccountId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid business account ID'
      });
    }
    
    let filter = { businessAccount: businessAccountId };
    if (year) filter.year = parseInt(year);
    
    const reports = await WeeklyReport.find(filter)
      .sort({ year: -1, month: 1 });
    
    const summary = reports.map(report => ({
      businessAccount: report.businessAccount,
      month: report.month,
      year: report.year,
      totalStaticTarget: report.totalStaticTarget || 0,
      totalReelsTarget: report.totalReelsTarget || 0,
      totalStaticCompleted: report.totalStaticCompleted || 0,
      totalReelsCompleted: report.totalReelsCompleted || 0,
      overallProgress: report.overallProgress || 0,
      totalPosts: report.weeks?.reduce((sum, week) => sum + (week.posts?.length || 0), 0) || 0,
      weeksCount: report.weeks?.length || 0
    }));
    
    res.status(200).json({
      success: true,
      count: summary.length,
      data: summary
    });
  } catch (error) {
    console.error('Error in getBusinessMonthlySummary:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Add a new week to report
// @route   POST /api/reports/:id/week
// @access  Public
const addWeek = async (req, res) => {
  try {
    const { id } = req.params;
    const { weekNumber, staticTarget, reelsTarget, weekStartDate, weekEndDate } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }
    
    const report = await WeeklyReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    const existingWeek = report.weeks.find(w => w.weekNumber === weekNumber);
    if (existingWeek) {
      return res.status(400).json({
        success: false,
        message: `Week ${weekNumber} already exists`
      });
    }
    
    report.weeks.push({
      weekNumber,
      staticTarget: staticTarget || 0,
      reelsTarget: reelsTarget || 0,
      weekStartDate: weekStartDate || null,
      weekEndDate: weekEndDate || null,
      posts: []
    });
    
    report.calculateTotals();
    report.calculateCompleted();
    report.calculateProgress();
    await report.save();
    
    res.status(201).json({
      success: true,
      message: `Week ${weekNumber} added successfully`,
      data: report
    });
  } catch (error) {
    console.error('Error in addWeek:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get monthly statistics
// @route   GET /api/reports/statistics/monthly
// @access  Public
const getMonthlyStatistics = async (req, res) => {
  try {
    const { businessAccount, year } = req.query;
    
    let filter = {};
    if (businessAccount) filter.businessAccount = businessAccount;
    if (year) filter.year = parseInt(year);
    else filter.year = new Date().getFullYear();
    
    const reports = await WeeklyReport.find(filter)
      .populate('businessAccount', 'businessName');
    
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const monthlyStats = {};
    months.forEach(month => {
      monthlyStats[month] = {
        totalStaticTarget: 0,
        totalReelsTarget: 0,
        totalStaticCompleted: 0,
        totalReelsCompleted: 0,
        reportsCount: 0,
        progress: 0
      };
    });
    
    reports.forEach(report => {
      const stats = monthlyStats[report.month];
      if (stats) {
        stats.totalStaticTarget += report.totalStaticTarget || 0;
        stats.totalReelsTarget += report.totalReelsTarget || 0;
        stats.totalStaticCompleted += report.totalStaticCompleted || 0;
        stats.totalReelsCompleted += report.totalReelsCompleted || 0;
        stats.reportsCount += 1;
      }
    });
    
    Object.keys(monthlyStats).forEach(month => {
      const stats = monthlyStats[month];
      const totalTarget = stats.totalStaticTarget + stats.totalReelsTarget;
      const totalCompleted = stats.totalStaticCompleted + stats.totalReelsCompleted;
      stats.progress = totalTarget > 0 ? (totalCompleted / totalTarget) * 100 : 0;
    });
    
    res.status(200).json({
      success: true,
      data: monthlyStats,
      year: filter.year
    });
  } catch (error) {
    console.error('Error in getMonthlyStatistics:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// ==================== CLIENT REPORT FUNCTIONS ====================
// @desc    Get client reports with complete details including posts and services
// @route   GET /api/reports/client/:businessAccountId
// @access  Public
const getClientReports = async (req, res) => {
  try {
    const { businessAccountId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(businessAccountId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid business account ID'
      });
    }
    
    const reports = await WeeklyReport.find({ businessAccount: businessAccountId })
      .populate('businessAccount', 'businessName email phone')
      .populate('services', 'serviceName isActive gstRate plans features')
      .sort({ year: -1, month: -1 });
    
    if (!reports || reports.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No reports found'
      });
    }
    
    const formattedReports = reports.map(report => {
      let totalStaticTarget = 0;
      let totalReelsTarget = 0;
      let totalStaticCompleted = 0;
      let totalReelsCompleted = 0;
      let allPosts = [];
      let allReels = [];
      
      // Get service details as plain object
      const serviceDetailsObj = report.serviceDetails ? Object.fromEntries(report.serviceDetails) : {};
      
      const weeklyData = (report.weeks || []).map(week => {
        const weekPosts = week.posts || [];
        const staticPostsList = weekPosts.filter(p => p.type === 'static' || p.type === 'post' || !p.type);
        const reelsPostsList = weekPosts.filter(p => p.type === 'reels' || p.type === 'reel');
        
        totalStaticTarget += week.staticTarget || 0;
        totalReelsTarget += week.reelsTarget || 0;
        totalStaticCompleted += staticPostsList.length;
        totalReelsCompleted += reelsPostsList.length;
        
        const formattedPosts = staticPostsList.map(p => ({
          id: p._id,
          title: p.title || 'Untitled Post',
          link: p.instagramLink || '',
          description: p.notes || '',
          postedDate: p.postedDate,
          type: p.type || 'static'
        }));
        
        const formattedReels = reelsPostsList.map(p => ({
          id: p._id,
          title: p.title || 'Untitled Reel',
          link: p.instagramLink || '',
          description: p.notes || '',
          postedDate: p.postedDate,
          type: p.type || 'reels'
        }));
        
        allPosts = [...allPosts, ...formattedPosts];
        allReels = [...allReels, ...formattedReels];
        
        const weekTotalTarget = (week.staticTarget || 0) + (week.reelsTarget || 0);
        const weekTotalCompleted = staticPostsList.length + reelsPostsList.length;
        const weekProgress = weekTotalTarget > 0 ? (weekTotalCompleted / weekTotalTarget) * 100 : 0;
        
        return {
          weekNumber: week.weekNumber,
          weekStartDate: week.weekStartDate,
          weekEndDate: week.weekEndDate,
          target: {
            statics: week.staticTarget || 0,
            reels: week.reelsTarget || 0
          },
          posted: {
            statics: staticPostsList.length,
            reels: reelsPostsList.length,
            posts: formattedPosts,
            reelsList: formattedReels
          },
          weekProgress: week.weekProgress || weekProgress,
          notes: week.notes || ""
        };
      });
      
      const totalTarget = totalStaticTarget + totalReelsTarget;
      const totalCompleted = totalStaticCompleted + totalReelsCompleted;
      const staticPercentage = totalStaticTarget > 0 ? (totalStaticCompleted / totalStaticTarget) * 100 : 0;
      const reelsPercentage = totalReelsTarget > 0 ? (totalReelsCompleted / totalReelsTarget) * 100 : 0;
      const overallPercentage = totalTarget > 0 ? (totalCompleted / totalTarget) * 100 : 0;
      
      return {
        _id: report._id,
        month: report.month,
        year: report.year,
        businessAccount: report.businessAccount,
        services: report.services,
        serviceDetails: serviceDetailsObj,
        totalTarget: {
          statics: totalStaticTarget,
          reels: totalReelsTarget,
          total: totalTarget
        },
        totalPosted: {
          statics: totalStaticCompleted,
          reels: totalReelsCompleted,
          total: totalCompleted
        },
        percentageAchieved: {
          statics: Number(staticPercentage.toFixed(2)),
          reels: Number(reelsPercentage.toFixed(2)),
          overall: Number(overallPercentage.toFixed(2))
        },
        weeklyData: weeklyData,
        allPosts: allPosts,
        allReels: allReels,
        postsCount: allPosts.length,
        reelsCount: allReels.length,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
      };
    });
    
    res.status(200).json({
      success: true,
      count: formattedReports.length,
      data: formattedReports
    });
    
  } catch (error) {
    console.error('Error in getClientReports:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get single client report with full details including posts and services
// @route   GET /api/reports/client/:businessAccountId/:reportId
// @access  Public
const getClientReportById = async (req, res) => {
  try {
    const { businessAccountId, reportId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(businessAccountId) || 
        !mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }
    
    const report = await WeeklyReport.findOne({
      _id: reportId,
      businessAccount: businessAccountId
    })
    .populate('businessAccount', 'businessName email phone address')
    .populate('services', 'serviceName isActive gstRate plans features');
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    let totalStaticTarget = 0;
    let totalReelsTarget = 0;
    let totalStaticCompleted = 0;
    let totalReelsCompleted = 0;
    let allPosts = [];
    let allReels = [];
    
    const serviceDetailsObj = report.serviceDetails ? Object.fromEntries(report.serviceDetails) : {};
    
    const weeklyData = (report.weeks || []).map(week => {
      const weekPosts = week.posts || [];
      const staticPostsList = weekPosts.filter(p => p.type === 'static' || p.type === 'post' || !p.type);
      const reelsPostsList = weekPosts.filter(p => p.type === 'reels' || p.type === 'reel');
      
      totalStaticTarget += week.staticTarget || 0;
      totalReelsTarget += week.reelsTarget || 0;
      totalStaticCompleted += staticPostsList.length;
      totalReelsCompleted += reelsPostsList.length;
      
      const formattedPosts = staticPostsList.map(p => ({
        id: p._id,
        title: p.title || 'Untitled Post',
        link: p.instagramLink || '',
        description: p.notes || '',
        postedDate: p.postedDate,
        type: p.type || 'static'
      }));
      
      const formattedReels = reelsPostsList.map(p => ({
        id: p._id,
        title: p.title || 'Untitled Reel',
        link: p.instagramLink || '',
        description: p.notes || '',
        postedDate: p.postedDate,
        type: p.type || 'reels'
      }));
      
      allPosts = [...allPosts, ...formattedPosts];
      allReels = [...allReels, ...formattedReels];
      
      const weekTotalTarget = (week.staticTarget || 0) + (week.reelsTarget || 0);
      const weekTotalCompleted = staticPostsList.length + reelsPostsList.length;
      const weekProgress = weekTotalTarget > 0 ? (weekTotalCompleted / weekTotalTarget) * 100 : 0;
      
      return {
        weekNumber: week.weekNumber,
        weekStartDate: week.weekStartDate,
        weekEndDate: week.weekEndDate,
        target: {
          statics: week.staticTarget || 0,
          reels: week.reelsTarget || 0
        },
        posted: {
          statics: staticPostsList.length,
          reels: reelsPostsList.length,
          posts: formattedPosts,
          reelsList: formattedReels
        },
        weekProgress: week.weekProgress || weekProgress,
        notes: week.notes || ""
      };
    });
    
    const totalTarget = totalStaticTarget + totalReelsTarget;
    const totalCompleted = totalStaticCompleted + totalReelsCompleted;
    const staticPercentage = totalStaticTarget > 0 ? (totalStaticCompleted / totalStaticTarget) * 100 : 0;
    const reelsPercentage = totalReelsTarget > 0 ? (totalReelsCompleted / totalReelsTarget) * 100 : 0;
    const overallPercentage = totalTarget > 0 ? (totalCompleted / totalTarget) * 100 : 0;
    
    const formattedReport = {
      _id: report._id,
      month: report.month,
      year: report.year,
      businessAccount: {
        _id: report.businessAccount._id,
        businessName: report.businessAccount.businessName,
        email: report.businessAccount.email,
        phone: report.businessAccount.phone
      },
      services: report.services,
      serviceDetails: serviceDetailsObj,
      summary: {
        totalStaticTarget,
        totalReelsTarget,
        totalTarget,
        totalStaticCompleted,
        totalReelsCompleted,
        totalCompleted,
        staticPercentage: Number(staticPercentage.toFixed(2)),
        reelsPercentage: Number(reelsPercentage.toFixed(2)),
        overallPercentage: Number(overallPercentage.toFixed(2))
      },
      weeklyData: weeklyData,
      allPosts: allPosts,
      allReels: allReels,
      postsCount: allPosts.length,
      reelsCount: allReels.length,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    };
    
    res.status(200).json({
      success: true,
      data: formattedReport
    });
    
  } catch (error) {
    console.error('Error in getClientReportById:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get client report statistics summary
// @route   GET /api/reports/client/:businessAccountId/statistics
// @access  Public
const getClientReportStatistics = async (req, res) => {
  try {
    const { businessAccountId } = req.params;
    const { year } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(businessAccountId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid business account ID'
      });
    }
    
    let filter = { businessAccount: businessAccountId };
    if (year) filter.year = parseInt(year);
    
    const reports = await WeeklyReport.find(filter)
      .populate('services', 'serviceName')
      .sort({ year: 1, month: 1 });
    
    const monthlyStats = {};
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    
    months.forEach(month => {
      monthlyStats[month] = {
        month,
        totalStaticTarget: 0,
        totalReelsTarget: 0,
        totalStaticCompleted: 0,
        totalReelsCompleted: 0,
        completionRate: 0,
        reportsCount: 0,
        services: []
      };
    });
    
    let totalAllStaticTarget = 0;
    let totalAllReelsTarget = 0;
    let totalAllStaticCompleted = 0;
    let totalAllReelsCompleted = 0;
    const allServicesMap = new Map();
    
    reports.forEach(report => {
      const stats = monthlyStats[report.month];
      if (stats) {
        const staticTarget = (report.weeks || []).reduce((sum, w) => sum + (w.staticTarget || 0), 0);
        const reelsTarget = (report.weeks || []).reduce((sum, w) => sum + (w.reelsTarget || 0), 0);
        const staticCompleted = (report.weeks || []).reduce((sum, w) => sum + (w.staticCompleted || 0), 0);
        const reelsCompleted = (report.weeks || []).reduce((sum, w) => sum + (w.reelsCompleted || 0), 0);
        
        stats.totalStaticTarget += staticTarget;
        stats.totalReelsTarget += reelsTarget;
        stats.totalStaticCompleted += staticCompleted;
        stats.totalReelsCompleted += reelsCompleted;
        stats.reportsCount += 1;
        
        totalAllStaticTarget += staticTarget;
        totalAllReelsTarget += reelsTarget;
        totalAllStaticCompleted += staticCompleted;
        totalAllReelsCompleted += reelsCompleted;
        
        // Track services
        if (report.services) {
          report.services.forEach(service => {
            if (!allServicesMap.has(service._id.toString())) {
              allServicesMap.set(service._id.toString(), service.serviceName);
            }
          });
        }
      }
    });
    
    Object.keys(monthlyStats).forEach(month => {
      const stats = monthlyStats[month];
      const totalTarget = stats.totalStaticTarget + stats.totalReelsTarget;
      const totalCompleted = stats.totalStaticCompleted + stats.totalReelsCompleted;
      stats.completionRate = totalTarget > 0 ? Number(((totalCompleted / totalTarget) * 100).toFixed(2)) : 0;
    });
    
    const totalOverallTarget = totalAllStaticTarget + totalAllReelsTarget;
    const totalOverallCompleted = totalAllStaticCompleted + totalAllReelsCompleted;
    const overallCompletionRate = totalOverallTarget > 0 ? Number(((totalOverallCompleted / totalOverallTarget) * 100).toFixed(2)) : 0;
    
    const monthsWithData = Object.values(monthlyStats).filter(m => m.reportsCount > 0);
    const bestMonth = monthsWithData.length > 0 ? 
      monthsWithData.reduce((best, curr) => curr.completionRate > best.completionRate ? curr : best, monthsWithData[0]) : null;
    const worstMonth = monthsWithData.length > 0 ?
      monthsWithData.reduce((worst, curr) => curr.completionRate < worst.completionRate ? curr : worst, monthsWithData[0]) : null;
    
    res.status(200).json({
      success: true,
      data: {
        overall: {
          totalStaticTarget: totalAllStaticTarget,
          totalReelsTarget: totalAllReelsTarget,
          totalStaticCompleted: totalAllStaticCompleted,
          totalReelsCompleted: totalAllReelsCompleted,
          overallCompletionRate,
          totalReports: reports.length,
          totalWeeks: reports.reduce((sum, r) => sum + (r.weeks?.length || 0), 0),
          servicesList: Array.from(allServicesMap.values())
        },
        monthlyStats: Object.values(monthlyStats).filter(m => m.reportsCount > 0),
        bestMonth,
        worstMonth,
        year: year || 'all'
      }
    });
    
  } catch (error) {
    console.error('Error in getClientReportStatistics:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// Export all functions
module.exports = {
  getAllReports,
  getReportById,
  createOrUpdateReport,
  updateReportServices,
  updateWeek,
  addPostToWeek,
  updatePostInWeek,
  deletePostFromWeek,
  deleteReport,
  getReportsByBusinessAccount,
  getBusinessMonthlySummary,
  addWeek,
  getMonthlyStatistics,
  getClientReports,
  getClientReportById,
  getClientReportStatistics
};