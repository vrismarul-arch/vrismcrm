const mongoose = require('mongoose');

// Service details schema for each selected service
const serviceDetailSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  price: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  },
  lifecycleStatus: {
    type: String,
    enum: ['active', 'inactive', 'live', 'not-live'],
    default: 'active'
  }
}, { _id: false });

const weeklyReportSchema = new mongoose.Schema({
  businessAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BusinessAccount",
    required: true,
  },
  month: {
    type: String,
    required: true,
    enum: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  },
  year: {
    type: Number,
    required: true,
    default: new Date().getFullYear()
  },
  
  // Services array
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "BrandService"
  }],
  
  // Service details map
  serviceDetails: {
    type: Map,
    of: serviceDetailSchema,
    default: new Map()
  },
  
  // ==================== MONTHLY TARGETS ====================
  totalStaticTarget: {
    type: Number,
    default: 0,
    description: "Total monthly static posts target"
  },
  totalReelsTarget: {
    type: Number,
    default: 0,
    description: "Total monthly Instagram reels target"
  },
  totalYouTubeShortsTarget: {
    type: Number,
    default: 0,
    description: "Total monthly YouTube Shorts target"
  },
  totalYouTubeVideoTarget: {
    type: Number,
    default: 0,
    description: "Total monthly YouTube full videos target"
  },
  
  // ==================== MONTHLY COMPLETED ====================
  totalStaticCompleted: {
    type: Number,
    default: 0,
    description: "Total monthly static posts completed"
  },
  totalReelsCompleted: {
    type: Number,
    default: 0,
    description: "Total monthly Instagram reels completed"
  },
  totalYouTubeShortsCompleted: {
    type: Number,
    default: 0,
    description: "Total monthly YouTube Shorts completed"
  },
  totalYouTubeVideoCompleted: {
    type: Number,
    default: 0,
    description: "Total monthly YouTube full videos completed"
  },
  
  // Overall progress percentage
  overallProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    description: "Overall monthly progress percentage"
  },
  
  // ==================== WEEKS ARRAY ====================
  weeks: [{
    weekNumber: {
      type: Number,
      required: true,
      enum: [1, 2, 3, 4, 5],
      description: "Week number (1-5)"
    },
    weekStartDate: {
      type: Date,
      default: null
    },
    weekEndDate: {
      type: Date,
      default: null
    },
    
    // Weekly targets
    staticTarget: {
      type: Number,
      default: 0,
      description: "Weekly static posts target"
    },
    reelsTarget: {
      type: Number,
      default: 0,
      description: "Weekly Instagram reels target"
    },
    youtubeShortsTarget: {
      type: Number,
      default: 0,
      description: "Weekly YouTube Shorts target"
    },
    youtubeVideoTarget: {
      type: Number,
      default: 0,
      description: "Weekly YouTube full videos target"
    },
    
    // Weekly completed counts
    staticCompleted: {
      type: Number,
      default: 0,
      description: "Weekly static posts completed"
    },
    reelsCompleted: {
      type: Number,
      default: 0,
      description: "Weekly Instagram reels completed"
    },
    youtubeShortsCompleted: {
      type: Number,
      default: 0,
      description: "Weekly YouTube Shorts completed"
    },
    youtubeVideoCompleted: {
      type: Number,
      default: 0,
      description: "Weekly YouTube full videos completed"
    },
    
    // Weekly progress
    weekProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      description: "Weekly progress percentage"
    },
    
    // Posts array for the week
    posts: [{
      title: {
        type: String,
        required: true,
        trim: true
      },
      instagramLink: {
        type: String,
        default: '',
        trim: true
      },
      youtubeLink: {
        type: String,
        default: '',
        trim: true
      },
      postedDate: {
        type: Date,
        default: Date.now
      },
      notes: {
        type: String,
        default: '',
        trim: true
      },
      type: {
        type: String,
        enum: ['static', 'reel', 'youtube-shorts', 'youtube-video'],
        required: true,
        default: 'static'
      }
    }],
    
    notes: {
      type: String,
      default: '',
      trim: true
    }
  }],
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==================== PRE-SAVE MIDDLEWARE ====================
weeklyReportSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate all totals before saving
  this.calculateTotals();
  this.calculateCompleted();
  this.calculateProgress();
  
  next();
});

// ==================== INSTANCE METHODS ====================

/**
 * Calculate monthly totals from weekly targets
 * @returns {Object} Total targets for all content types
 */
weeklyReportSchema.methods.calculateTotals = function() {
  let totalStatic = 0;
  let totalReels = 0;
  let totalYouTubeShorts = 0;
  let totalYouTubeVideo = 0;
  
  this.weeks.forEach(week => {
    totalStatic += week.staticTarget || 0;
    totalReels += week.reelsTarget || 0;
    totalYouTubeShorts += week.youtubeShortsTarget || 0;
    totalYouTubeVideo += week.youtubeVideoTarget || 0;
  });
  
  this.totalStaticTarget = totalStatic;
  this.totalReelsTarget = totalReels;
  this.totalYouTubeShortsTarget = totalYouTubeShorts;
  this.totalYouTubeVideoTarget = totalYouTubeVideo;
  
  return { 
    totalStatic, 
    totalReels, 
    totalYouTubeShorts, 
    totalYouTubeVideo 
  };
};

/**
 * Calculate completed counts from posts
 * @returns {Object} Total completed counts for all content types
 */
weeklyReportSchema.methods.calculateCompleted = function() {
  let totalStaticCompleted = 0;
  let totalReelsCompleted = 0;
  let totalYouTubeShortsCompleted = 0;
  let totalYouTubeVideoCompleted = 0;
  
  this.weeks.forEach(week => {
    // Count completed posts per type from the posts array
    const staticPosts = week.posts?.filter(post => post.type === 'static').length || 0;
    const reelPosts = week.posts?.filter(post => post.type === 'reel').length || 0;
    const youtubeShortsPosts = week.posts?.filter(post => post.type === 'youtube-shorts').length || 0;
    const youtubeVideoPosts = week.posts?.filter(post => post.type === 'youtube-video').length || 0;
    
    // Calculate completed (cannot exceed target)
    week.staticCompleted = Math.min(staticPosts, week.staticTarget || 0);
    week.reelsCompleted = Math.min(reelPosts, week.reelsTarget || 0);
    week.youtubeShortsCompleted = Math.min(youtubeShortsPosts, week.youtubeShortsTarget || 0);
    week.youtubeVideoCompleted = Math.min(youtubeVideoPosts, week.youtubeVideoTarget || 0);
    
    // Calculate week progress percentage
    const weekTotalTarget = (week.staticTarget || 0) + (week.reelsTarget || 0) + 
                            (week.youtubeShortsTarget || 0) + (week.youtubeVideoTarget || 0);
    const weekTotalCompleted = week.staticCompleted + week.reelsCompleted + 
                               week.youtubeShortsCompleted + week.youtubeVideoCompleted;
    week.weekProgress = weekTotalTarget > 0 ? (weekTotalCompleted / weekTotalTarget) * 100 : 0;
    
    // Add to monthly totals
    totalStaticCompleted += week.staticCompleted;
    totalReelsCompleted += week.reelsCompleted;
    totalYouTubeShortsCompleted += week.youtubeShortsCompleted;
    totalYouTubeVideoCompleted += week.youtubeVideoCompleted;
  });
  
  this.totalStaticCompleted = totalStaticCompleted;
  this.totalReelsCompleted = totalReelsCompleted;
  this.totalYouTubeShortsCompleted = totalYouTubeShortsCompleted;
  this.totalYouTubeVideoCompleted = totalYouTubeVideoCompleted;
  
  return { 
    totalStaticCompleted, 
    totalReelsCompleted, 
    totalYouTubeShortsCompleted, 
    totalYouTubeVideoCompleted 
  };
};

/**
 * Calculate overall monthly progress percentage
 * @returns {Number} Overall progress percentage (0-100)
 */
weeklyReportSchema.methods.calculateProgress = function() {
  const totalTarget = this.totalStaticTarget + this.totalReelsTarget + 
                      this.totalYouTubeShortsTarget + this.totalYouTubeVideoTarget;
  const totalCompleted = this.totalStaticCompleted + this.totalReelsCompleted + 
                         this.totalYouTubeShortsCompleted + this.totalYouTubeVideoCompleted;
  this.overallProgress = totalTarget > 0 ? (totalCompleted / totalTarget) * 100 : 0;
  return this.overallProgress;
};

/**
 * Get week by week number
 * @param {Number} weekNumber - Week number (1-5)
 * @returns {Object|null} Week object or null if not found
 */
weeklyReportSchema.methods.getWeek = function(weekNumber) {
  return this.weeks.find(w => w.weekNumber === weekNumber);
};

/**
 * Update or add a week
 * @param {Number} weekNumber - Week number (1-5)
 * @param {Object} weekData - Week data to update
 */
weeklyReportSchema.methods.updateWeek = function(weekNumber, weekData) {
  const weekIndex = this.weeks.findIndex(w => w.weekNumber === weekNumber);
  
  if (weekIndex === -1) {
    // Add new week
    this.weeks.push({
      weekNumber,
      staticTarget: weekData.staticTarget || 0,
      reelsTarget: weekData.reelsTarget || 0,
      youtubeShortsTarget: weekData.youtubeShortsTarget || 0,
      youtubeVideoTarget: weekData.youtubeVideoTarget || 0,
      weekStartDate: weekData.weekStartDate || null,
      weekEndDate: weekData.weekEndDate || null,
      posts: weekData.posts || []
    });
  } else {
    // Update existing week
    const existingWeek = this.weeks[weekIndex];
    if (weekData.staticTarget !== undefined) existingWeek.staticTarget = weekData.staticTarget;
    if (weekData.reelsTarget !== undefined) existingWeek.reelsTarget = weekData.reelsTarget;
    if (weekData.youtubeShortsTarget !== undefined) existingWeek.youtubeShortsTarget = weekData.youtubeShortsTarget;
    if (weekData.youtubeVideoTarget !== undefined) existingWeek.youtubeVideoTarget = weekData.youtubeVideoTarget;
    if (weekData.weekStartDate !== undefined) existingWeek.weekStartDate = weekData.weekStartDate;
    if (weekData.weekEndDate !== undefined) existingWeek.weekEndDate = weekData.weekEndDate;
    if (weekData.posts !== undefined) existingWeek.posts = weekData.posts;
  }
  
  // Recalculate all totals
  this.calculateTotals();
  this.calculateCompleted();
  this.calculateProgress();
};

/**
 * Add a post to a specific week
 * @param {Number} weekNumber - Week number (1-5)
 * @param {Object} postData - Post data
 * @returns {Object} The added post
 */
weeklyReportSchema.methods.addPost = function(weekNumber, postData) {
  const week = this.getWeek(weekNumber);
  if (!week) {
    throw new Error(`Week ${weekNumber} not found`);
  }
  
  const newPost = {
    title: postData.title,
    instagramLink: postData.instagramLink || '',
    youtubeLink: postData.youtubeLink || '',
    postedDate: postData.postedDate || new Date(),
    notes: postData.notes || '',
    type: postData.type || 'static'
  };
  
  week.posts.push(newPost);
  
  // Recalculate totals
  this.calculateCompleted();
  this.calculateProgress();
  
  return newPost;
};

/**
 * Update a post in a specific week
 * @param {Number} weekNumber - Week number (1-5)
 * @param {Number} postIndex - Index of the post in the posts array
 * @param {Object} updateData - Data to update
 * @returns {Object} The updated post
 */
weeklyReportSchema.methods.updatePost = function(weekNumber, postIndex, updateData) {
  const week = this.getWeek(weekNumber);
  if (!week) {
    throw new Error(`Week ${weekNumber} not found`);
  }
  
  const post = week.posts[postIndex];
  if (!post) {
    throw new Error(`Post at index ${postIndex} not found`);
  }
  
  if (updateData.title !== undefined) post.title = updateData.title;
  if (updateData.instagramLink !== undefined) post.instagramLink = updateData.instagramLink;
  if (updateData.youtubeLink !== undefined) post.youtubeLink = updateData.youtubeLink;
  if (updateData.postedDate !== undefined) post.postedDate = updateData.postedDate;
  if (updateData.notes !== undefined) post.notes = updateData.notes;
  if (updateData.type !== undefined) post.type = updateData.type;
  
  // Recalculate totals
  this.calculateCompleted();
  this.calculateProgress();
  
  return post;
};

/**
 * Delete a post from a specific week
 * @param {Number} weekNumber - Week number (1-5)
 * @param {Number} postIndex - Index of the post in the posts array
 * @returns {Boolean} True if deleted successfully
 */
weeklyReportSchema.methods.deletePost = function(weekNumber, postIndex) {
  const week = this.getWeek(weekNumber);
  if (!week) {
    throw new Error(`Week ${weekNumber} not found`);
  }
  
  if (postIndex < 0 || postIndex >= week.posts.length) {
    throw new Error(`Post at index ${postIndex} not found`);
  }
  
  week.posts.splice(postIndex, 1);
  
  // Recalculate totals
  this.calculateCompleted();
  this.calculateProgress();
  
  return true;
};

/**
 * Get weekly summary for a specific week
 * @param {Number} weekNumber - Week number (1-5)
 * @returns {Object} Weekly summary
 */
weeklyReportSchema.methods.getWeeklySummary = function(weekNumber) {
  const week = this.getWeek(weekNumber);
  if (!week) {
    return null;
  }
  
  const totalTarget = (week.staticTarget || 0) + (week.reelsTarget || 0) + 
                      (week.youtubeShortsTarget || 0) + (week.youtubeVideoTarget || 0);
  const totalCompleted = (week.staticCompleted || 0) + (week.reelsCompleted || 0) + 
                         (week.youtubeShortsCompleted || 0) + (week.youtubeVideoCompleted || 0);
  
  return {
    weekNumber: week.weekNumber,
    weekStartDate: week.weekStartDate,
    weekEndDate: week.weekEndDate,
    targets: {
      static: week.staticTarget || 0,
      reels: week.reelsTarget || 0,
      youtubeShorts: week.youtubeShortsTarget || 0,
      youtubeVideos: week.youtubeVideoTarget || 0,
      total: totalTarget
    },
    completed: {
      static: week.staticCompleted || 0,
      reels: week.reelsCompleted || 0,
      youtubeShorts: week.youtubeShortsCompleted || 0,
      youtubeVideos: week.youtubeVideoCompleted || 0,
      total: totalCompleted
    },
    progress: week.weekProgress || 0,
    postsCount: week.posts?.length || 0,
    posts: week.posts || []
  };
};

/**
 * Get monthly summary
 * @returns {Object} Monthly summary
 */
weeklyReportSchema.methods.getMonthlySummary = function() {
  const totalTarget = this.totalStaticTarget + this.totalReelsTarget + 
                      this.totalYouTubeShortsTarget + this.totalYouTubeVideoTarget;
  const totalCompleted = this.totalStaticCompleted + this.totalReelsCompleted + 
                         this.totalYouTubeShortsCompleted + this.totalYouTubeVideoCompleted;
  
  return {
    businessAccount: this.businessAccount,
    month: this.month,
    year: this.year,
    targets: {
      static: this.totalStaticTarget || 0,
      reels: this.totalReelsTarget || 0,
      youtubeShorts: this.totalYouTubeShortsTarget || 0,
      youtubeVideos: this.totalYouTubeVideoTarget || 0,
      total: totalTarget
    },
    completed: {
      static: this.totalStaticCompleted || 0,
      reels: this.totalReelsCompleted || 0,
      youtubeShorts: this.totalYouTubeShortsCompleted || 0,
      youtubeVideos: this.totalYouTubeVideoCompleted || 0,
      total: totalCompleted
    },
    progress: this.overallProgress || 0,
    weeksCount: this.weeks?.length || 0,
    servicesCount: this.services?.length || 0,
    totalPosts: this.weeks?.reduce((sum, week) => sum + (week.posts?.length || 0), 0) || 0
  };
};

// ==================== STATIC METHODS ====================

/**
 * Find reports by business account with filters
 * @param {String} businessAccountId - Business account ID
 * @param {Object} options - Filter options (year, month)
 * @returns {Promise<Array>} Array of reports
 */
weeklyReportSchema.statics.findByBusinessAccount = function(businessAccountId, options = {}) {
  const filter = { businessAccount: businessAccountId };
  if (options.year) filter.year = options.year;
  if (options.month) filter.month = options.month;
  
  return this.find(filter)
    .populate('businessAccount', 'businessName email phone')
    .populate('services', 'serviceName isActive')
    .sort({ year: -1, month: -1 });
};

/**
 * Get all reports for a specific year
 * @param {Number} year - Year
 * @returns {Promise<Array>} Array of reports
 */
weeklyReportSchema.statics.findByYear = function(year) {
  return this.find({ year })
    .populate('businessAccount', 'businessName')
    .sort({ month: 1 });
};

/**
 * Get overall statistics across all reports
 * @param {Object} filter - MongoDB filter
 * @returns {Promise<Object>} Statistics object
 */
weeklyReportSchema.statics.getOverallStatistics = async function(filter = {}) {
  const reports = await this.find(filter);
  
  let totalStaticTarget = 0;
  let totalReelsTarget = 0;
  let totalYouTubeShortsTarget = 0;
  let totalYouTubeVideoTarget = 0;
  let totalStaticCompleted = 0;
  let totalReelsCompleted = 0;
  let totalYouTubeShortsCompleted = 0;
  let totalYouTubeVideoCompleted = 0;
  let totalReports = reports.length;
  
  reports.forEach(report => {
    totalStaticTarget += report.totalStaticTarget || 0;
    totalReelsTarget += report.totalReelsTarget || 0;
    totalYouTubeShortsTarget += report.totalYouTubeShortsTarget || 0;
    totalYouTubeVideoTarget += report.totalYouTubeVideoTarget || 0;
    totalStaticCompleted += report.totalStaticCompleted || 0;
    totalReelsCompleted += report.totalReelsCompleted || 0;
    totalYouTubeShortsCompleted += report.totalYouTubeShortsCompleted || 0;
    totalYouTubeVideoCompleted += report.totalYouTubeVideoCompleted || 0;
  });
  
  const totalTarget = totalStaticTarget + totalReelsTarget + 
                      totalYouTubeShortsTarget + totalYouTubeVideoTarget;
  const totalCompleted = totalStaticCompleted + totalReelsCompleted + 
                         totalYouTubeShortsCompleted + totalYouTubeVideoCompleted;
  
  return {
    totalReports,
    totalTarget,
    totalCompleted,
    overallProgress: totalTarget > 0 ? (totalCompleted / totalTarget) * 100 : 0,
    breakdown: {
      static: { target: totalStaticTarget, completed: totalStaticCompleted },
      reels: { target: totalReelsTarget, completed: totalReelsCompleted },
      youtubeShorts: { target: totalYouTubeShortsTarget, completed: totalYouTubeShortsCompleted },
      youtubeVideos: { target: totalYouTubeVideoTarget, completed: totalYouTubeVideoCompleted }
    }
  };
};

// ==================== VIRTUAL PROPERTIES ====================

// Virtual for total monthly target (all types combined)
weeklyReportSchema.virtual('monthlyTotalTarget').get(function() {
  return (this.totalStaticTarget || 0) + (this.totalReelsTarget || 0) + 
         (this.totalYouTubeShortsTarget || 0) + (this.totalYouTubeVideoTarget || 0);
});

// Virtual for total monthly completed (all types combined)
weeklyReportSchema.virtual('monthlyTotalCompleted').get(function() {
  return (this.totalStaticCompleted || 0) + (this.totalReelsCompleted || 0) + 
         (this.totalYouTubeShortsCompleted || 0) + (this.totalYouTubeVideoCompleted || 0);
});

// Virtual for is complete (100%)
weeklyReportSchema.virtual('isComplete').get(function() {
  return this.overallProgress >= 100;
});

// Virtual for report status text
weeklyReportSchema.virtual('status').get(function() {
  if (this.overallProgress === 0) return 'pending';
  if (this.overallProgress >= 100) return 'completed';
  return 'in-progress';
});

// ==================== INDEXES ====================
weeklyReportSchema.index({ businessAccount: 1, year: 1, month: 1 }, { unique: true });
weeklyReportSchema.index({ year: 1, month: 1 });
weeklyReportSchema.index({ createdBy: 1 });
weeklyReportSchema.index({ createdAt: -1 });
weeklyReportSchema.index({ 'weeks.weekNumber': 1 });

module.exports = mongoose.model('WeeklyReport', weeklyReportSchema);