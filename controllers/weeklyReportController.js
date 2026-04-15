const WeeklyReport = require("../models/WeeklyReport");
const BusinessAccount = require("../models/BusinessAccount");

// ✅ CREATE REPORT
// ✅ CREATE REPORT - FIXED VERSION
// ✅ CREATE REPORT - COMPLETELY FIXED VERSION
exports.createReport = async (req, res) => {
  try {
    const { businessAccount, month, weeklyData } = req.body;

    console.log("Creating report for:", { businessAccount, month });
    console.log("Weekly data:", JSON.stringify(weeklyData, null, 2));

    if (!businessAccount || !month) {
      return res.status(400).json({
        success: false,
        message: "businessAccount and month are required",
      });
    }

    const accountExists = await BusinessAccount.findById(businessAccount);
    if (!accountExists) {
      return res.status(404).json({
        success: false,
        message: "Business account not found",
      });
    }

    const existingReport = await WeeklyReport.findOne({
      businessAccount,
      month,
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: "Report already exists for this client and month",
      });
    }

    // Process weekly data to match schema structure
    const processedWeeklyData = weeklyData.map(week => {
      // Calculate posted counts
      let postedStatics = 0;
      let postedReels = 0;
      let postsArray = [];
      let reelsArray = [];
      
      // Handle posts
      if (week.posted) {
        // Check if posts array exists
        if (week.posted.posts && Array.isArray(week.posted.posts)) {
          postsArray = week.posted.posts.map(post => ({
            title: post.title || "",
            link: post.link || "",
            postedDate: post.postedDate ? new Date(post.postedDate) : new Date()
          }));
          postedStatics = postsArray.length;
        } else if (typeof week.posted.statics === 'number') {
          postedStatics = week.posted.statics;
        }
        
        // Handle reels - frontend sends reels as array
        if (week.posted.reels && Array.isArray(week.posted.reels)) {
          reelsArray = week.posted.reels.map(reel => ({
            title: reel.title || "",
            link: reel.link || "",
            postedDate: reel.postedDate ? new Date(reel.postedDate) : new Date()
          }));
          postedReels = reelsArray.length;
        } else if (typeof week.posted.reels === 'number') {
          postedReels = week.posted.reels;
        }
        
        // Also check for reelsList (backend format)
        if (week.posted.reelsList && Array.isArray(week.posted.reelsList)) {
          reelsArray = week.posted.reelsList.map(reel => ({
            title: reel.title || "",
            link: reel.link || "",
            postedDate: reel.postedDate ? new Date(reel.postedDate) : new Date()
          }));
          postedReels = reelsArray.length;
        }
      }
      
      return {
        weekNumber: week.weekNumber,
        target: {
          statics: week.target?.statics || 0,
          reels: week.target?.reels || 0,
        },
        posted: {
          statics: postedStatics,
          reels: postedReels,
          posts: postsArray,
          reelsList: reelsArray,
        },
        notes: week.notes || "",
      };
    });

    // Calculate totals
    let totalPostedStatics = 0;
    let totalPostedReels = 0;
    let totalTargetStatics = 0;
    let totalTargetReels = 0;

    processedWeeklyData.forEach((w) => {
      totalPostedStatics += w.posted?.statics || 0;
      totalPostedReels += w.posted?.reels || 0;
      totalTargetStatics += w.target?.statics || 0;
      totalTargetReels += w.target?.reels || 0;
    });

    const percentageStatics = totalTargetStatics
      ? Number(((totalPostedStatics / totalTargetStatics) * 100).toFixed(1))
      : 0;

    const percentageReels = totalTargetReels
      ? Number(((totalPostedReels / totalTargetReels) * 100).toFixed(1))
      : 0;

    const reportData = {
      businessAccount,
      month,
      weeklyData: processedWeeklyData,
      totalPosted: {
        statics: totalPostedStatics,
        reels: totalPostedReels,
      },
      totalTarget: {
        statics: totalTargetStatics,
        reels: totalTargetReels,
      },
      percentageAchieved: {
        statics: percentageStatics,
        reels: percentageReels,
      },
    };

    console.log("Processed report data:", JSON.stringify(reportData, null, 2));

    const report = await WeeklyReport.create(reportData);
    await report.populate("businessAccount", "businessName email");

    res.status(201).json({
      success: true,
      message: "Report created successfully",
      data: report,
    });
  } catch (err) {
    console.error("CREATE REPORT ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ✅ GET ALL REPORTS
// ✅ GET ALL REPORTS - FIXED
exports.getReports = async (req, res) => {
  try {
    const { month, clientId, year, page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    let query = {};
    
    if (month) {
      query.month = { $regex: month, $options: "i" };
    }
    if (year) {
      query.month = { $regex: year, $options: "i" };
    }
    if (clientId) {
      query.businessAccount = clientId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'desc' ? -1 : 1;
    const sortOptions = { [sortBy]: sortOrder };

    const reports = await WeeklyReport.find(query)
      .populate("businessAccount", "businessName email businessType")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await WeeklyReport.countDocuments(query);

    // Always return 200 even if no reports
    res.status(200).json({
      success: true,
      count: reports.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: reports,
    });
  } catch (err) {
    console.error("GET REPORTS ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ✅ GET REPORT BY ID
exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await WeeklyReport.findById(id)
      .populate("businessAccount", "businessName email businessType contactPerson");

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (err) {
    console.error("GET REPORT BY ID ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ✅ GET REPORT BY CLIENT ID (For Client Dashboard)
// ✅ GET REPORT BY CLIENT ID (For Client Dashboard) - FIXED
exports.getReportByClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year } = req.query;

    console.log("Fetching reports for client:", id, { month, year });

    let query = { businessAccount: id };
    
    if (month) {
      query.month = month;
    } else if (year) {
      query.month = { $regex: year, $options: "i" };
    }

    const reports = await WeeklyReport.find(query)
      .populate("businessAccount", "businessName email instagramHandle businessType")
      .sort({ month: -1 });

    // Calculate client statistics even if no reports
    const clientStats = {
      totalReports: reports.length,
      averageStaticsAchievement: 0,
      averageReelsAchievement: 0,
      totalPosts: 0,
      totalReels: 0,
      bestMonth: null,
    };

    if (reports.length > 0) {
      let totalStaticsPercent = 0;
      let totalReelsPercent = 0;
      let bestScore = 0;

      reports.forEach(report => {
        totalStaticsPercent += report.percentageAchieved?.statics || 0;
        totalReelsPercent += report.percentageAchieved?.reels || 0;
        clientStats.totalPosts += report.totalPosted?.statics || 0;
        clientStats.totalReels += report.totalPosted?.reels || 0;
        
        const score = ((report.percentageAchieved?.statics || 0) + (report.percentageAchieved?.reels || 0)) / 2;
        if (score > bestScore) {
          bestScore = score;
          clientStats.bestMonth = report.month;
        }
      });

      clientStats.averageStaticsAchievement = (totalStaticsPercent / reports.length).toFixed(1);
      clientStats.averageReelsAchievement = (totalReelsPercent / reports.length).toFixed(1);
    }

    // Return 200 even if no reports found (with empty array)
    res.status(200).json({
      success: true,
      count: reports.length,
      statistics: clientStats,
      data: reports,
    });
  } catch (err) {
    console.error("GET CLIENT REPORTS ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ✅ UPDATE REPORT
// ✅ UPDATE REPORT - FIXED VERSION
exports.updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { weeklyData, month, businessAccount } = req.body;

    console.log("Updating report with data:", JSON.stringify({ weeklyData, month, businessAccount }, null, 2));

    const existingReport = await WeeklyReport.findById(id);
    if (!existingReport) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    let totalPostedStatics = 0;
    let totalPostedReels = 0;
    let totalTargetStatics = 0;
    let totalTargetReels = 0;

    const dataToUpdate = weeklyData || existingReport.weeklyData;

    // Process the data to match the schema structure
    const processedData = dataToUpdate.map(week => {
      const processed = {
        weekNumber: week.weekNumber,
        target: {
          statics: week.target?.statics || 0,
          reels: week.target?.reels || 0,
        },
        notes: week.notes || "",
        posted: {
          statics: 0,
          reels: 0,
          posts: [],
          reelsList: [],
        }
      };
      
      // Handle posts
      if (week.posted) {
        // Handle posts array
        if (week.posted.posts && Array.isArray(week.posted.posts)) {
          processed.posted.posts = week.posted.posts.map(post => ({
            title: post.title || "",
            link: post.link || "",
            postedDate: post.postedDate ? new Date(post.postedDate) : new Date()
          }));
          processed.posted.statics = processed.posted.posts.length;
        } else if (week.posted.statics && typeof week.posted.statics === 'number') {
          processed.posted.statics = week.posted.statics;
        }
        
        // Handle reels
        if (week.posted.reels && Array.isArray(week.posted.reels)) {
          processed.posted.reelsList = week.posted.reels.map(reel => ({
            title: reel.title || "",
            link: reel.link || "",
            postedDate: reel.postedDate ? new Date(reel.postedDate) : new Date()
          }));
          processed.posted.reels = processed.posted.reelsList.length;
        } else if (week.posted.reels && typeof week.posted.reels === 'number') {
          processed.posted.reels = week.posted.reels;
        }
        
        // Handle reelsList if present
        if (week.posted.reelsList && Array.isArray(week.posted.reelsList)) {
          processed.posted.reelsList = week.posted.reelsList.map(reel => ({
            title: reel.title || "",
            link: reel.link || "",
            postedDate: reel.postedDate ? new Date(reel.postedDate) : new Date()
          }));
          processed.posted.reels = processed.posted.reelsList.length;
        }
      }
      
      totalPostedStatics += processed.posted.statics || 0;
      totalPostedReels += processed.posted.reels || 0;
      totalTargetStatics += processed.target.statics || 0;
      totalTargetReels += processed.target.reels || 0;
      
      return processed;
    });

    const updateData = {
      weeklyData: processedData,
      totalPosted: {
        statics: totalPostedStatics,
        reels: totalPostedReels,
      },
      totalTarget: {
        statics: totalTargetStatics,
        reels: totalTargetReels,
      },
      percentageAchieved: {
        statics: totalTargetStatics
          ? Number(((totalPostedStatics / totalTargetStatics) * 100).toFixed(1))
          : 0,
        reels: totalTargetReels
          ? Number(((totalPostedReels / totalTargetReels) * 100).toFixed(1))
          : 0,
      },
    };

    if (month) updateData.month = month;
    if (businessAccount) updateData.businessAccount = businessAccount;

    console.log("Update data being sent:", JSON.stringify(updateData, null, 2));

    const updated = await WeeklyReport.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("businessAccount", "businessName email");

    res.json({
      success: true,
      message: "Report updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ✅ DELETE REPORT
exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await WeeklyReport.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ✅ BULK DELETE REPORTS
exports.bulkDeleteReports = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of report IDs",
      });
    }

    const result = await WeeklyReport.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} reports`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("BULK DELETE ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ✅ GET MONTHLY SUMMARY
exports.getMonthlySummary = async (req, res) => {
  try {
    const { year } = req.params;
    const targetYear = year || new Date().getFullYear().toString();
    
    const reports = await WeeklyReport.find({
      month: { $regex: targetYear, $options: "i" }
    }).populate("businessAccount", "businessName");

    const monthlyData = {};
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    
    months.forEach(month => {
      monthlyData[month] = {
        totalReports: 0,
        avgAchievement: 0,
        totalPosts: 0,
        totalTargets: 0,
        reports: [],
      };
    });
    
    reports.forEach(report => {
      const monthName = report.month.split(' ')[0];
      if (monthlyData[monthName]) {
        monthlyData[monthName].totalReports++;
        monthlyData[monthName].totalPosts += (report.totalPosted?.statics || 0) + (report.totalPosted?.reels || 0);
        monthlyData[monthName].totalTargets += (report.totalTarget?.statics || 0) + (report.totalTarget?.reels || 0);
        monthlyData[monthName].reports.push({
          id: report._id,
          client: report.businessAccount?.businessName,
          achievement: ((report.percentageAchieved?.statics || 0) + (report.percentageAchieved?.reels || 0)) / 2,
        });
      }
    });

    res.json({
      success: true,
      year: targetYear,
      monthlyData,
    });
  } catch (err) {
    console.error("MONTHLY SUMMARY ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ✅ GET PERFORMANCE ANALYTICS
exports.getPerformanceAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, clientId } = req.query;
    
    let query = {};
    
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    if (clientId) {
      query.businessAccount = clientId;
    }

    const reports = await WeeklyReport.find(query)
      .populate("businessAccount", "businessName");

    const analytics = {
      totalReports: reports.length,
      performanceDistribution: {
        excellent: 0,
        good: 0,
        average: 0,
        poor: 0,
      },
      topPerformers: [],
      needsImprovement: [],
    };

    reports.forEach(report => {
      const overallAchievement = ((report.percentageAchieved?.statics || 0) + 
                                  (report.percentageAchieved?.reels || 0)) / 2;
      
      if (overallAchievement >= 90) analytics.performanceDistribution.excellent++;
      else if (overallAchievement >= 70) analytics.performanceDistribution.good++;
      else if (overallAchievement >= 50) analytics.performanceDistribution.average++;
      else analytics.performanceDistribution.poor++;
    });

    res.json({
      success: true,
      analytics,
    });
  } catch (err) {
    console.error("PERFORMANCE ANALYTICS ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ✅ GET CLIENT DASHBOARD STATS (For logged-in client)
exports.getClientDashboard = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { year } = req.query;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required",
      });
    }

    let query = { businessAccount: clientId };
    if (year) {
      query.month = { $regex: year, $options: "i" };
    }

    const reports = await WeeklyReport.find(query)
      .populate("businessAccount", "businessName email instagramHandle")
      .sort({ month: -1 });

    const clientInfo = await BusinessAccount.findById(clientId);

    let totalPosts = 0;
    let totalReels = 0;
    let totalStaticsTarget = 0;
    let totalReelsTarget = 0;
    let totalStaticsAchieved = 0;
    let totalReelsAchieved = 0;
    let bestMonth = null;
    let bestScore = 0;

    reports.forEach(report => {
      totalPosts += report.totalPosted?.statics || 0;
      totalReels += report.totalPosted?.reels || 0;
      totalStaticsTarget += report.totalTarget?.statics || 0;
      totalReelsTarget += report.totalTarget?.reels || 0;
      totalStaticsAchieved += report.percentageAchieved?.statics || 0;
      totalReelsAchieved += report.percentageAchieved?.reels || 0;

      const score = ((report.percentageAchieved?.statics || 0) + (report.percentageAchieved?.reels || 0)) / 2;
      if (score > bestScore) {
        bestScore = score;
        bestMonth = report.month;
      }
    });

    const dashboardStats = {
      totalReports: reports.length,
      totalPosts,
      totalReels,
      totalContent: totalPosts + totalReels,
      averageStaticsAchievement: reports.length > 0 ? (totalStaticsAchieved / reports.length).toFixed(1) : 0,
      averageReelsAchievement: reports.length > 0 ? (totalReelsAchieved / reports.length).toFixed(1) : 0,
      overallAchievement: reports.length > 0 
        ? ((totalStaticsAchieved + totalReelsAchieved) / (reports.length * 2)).toFixed(1) 
        : 0,
      targetCompletion: totalStaticsTarget > 0 
        ? ((totalPosts / totalStaticsTarget) * 100).toFixed(1) 
        : 0,
      bestMonth,
      clientInfo: {
        name: clientInfo?.businessName,
        instagramHandle: clientInfo?.instagramHandle,
        businessType: clientInfo?.businessType,
      },
      monthlyTrend: reports.map(r => ({
        month: r.month,
        achievement: ((r.percentageAchieved?.statics || 0) + (r.percentageAchieved?.reels || 0)) / 2,
        posts: r.totalPosted?.statics || 0,
        reels: r.totalPosted?.reels || 0,
      })),
    };

    res.json({
      success: true,
      data: dashboardStats,
      reports,
    });
  } catch (err) {
    console.error("CLIENT DASHBOARD ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ✅ EXPORT ALL FUNCTIONS - FIXED
module.exports = {
  createReport: exports.createReport,
  getReports: exports.getReports,
  getReportById: exports.getReportById,
  getReportByClient: exports.getReportByClient,
  updateReport: exports.updateReport,
  deleteReport: exports.deleteReport,
  bulkDeleteReports: exports.bulkDeleteReports,
  getMonthlySummary: exports.getMonthlySummary,
  getPerformanceAnalytics: exports.getPerformanceAnalytics,
  getClientDashboard: exports.getClientDashboard,
};