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
  // NEW: Services array
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "BrandService"
  }],
  // NEW: Service details map
  serviceDetails: {
    type: Map,
    of: serviceDetailSchema,
    default: new Map()
  },
  totalStaticTarget: {
    type: Number,
    default: 0
  },
  totalReelsTarget: {
    type: Number,
    default: 0
  },
  totalStaticCompleted: {
    type: Number,
    default: 0
  },
  totalReelsCompleted: {
    type: Number,
    default: 0
  },
  overallProgress: {
    type: Number,
    default: 0
  },
  weeks: [{
    weekNumber: {
      type: Number,
      required: true,
      enum: [1, 2, 3, 4, 5]
    },
    weekStartDate: Date,
    weekEndDate: Date,
    staticTarget: {
      type: Number,
      default: 0
    },
    reelsTarget: {
      type: Number,
      default: 0
    },
    staticCompleted: {
      type: Number,
      default: 0
    },
    reelsCompleted: {
      type: Number,
      default: 0
    },
    weekProgress: {
      type: Number,
      default: 0
    },
    posts: [{
      title: String,
      instagramLink: String,
      postedDate: Date,
      notes: String,
      type: {
        type: String,
        enum: ['static', 'reel']
      }
    }]
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
});

weeklyReportSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate all totals before saving
  this.calculateTotals();
  this.calculateCompleted();
  this.calculateProgress();
  
  next();
});

// Method to calculate totals from weeks
weeklyReportSchema.methods.calculateTotals = function() {
  let totalStatic = 0;
  let totalReels = 0;
  
  this.weeks.forEach(week => {
    totalStatic += week.staticTarget || 0;
    totalReels += week.reelsTarget || 0;
  });
  
  this.totalStaticTarget = totalStatic;
  this.totalReelsTarget = totalReels;
  
  return { totalStatic, totalReels };
};

// Method to calculate completed posts
weeklyReportSchema.methods.calculateCompleted = function() {
  let totalStaticCompleted = 0;
  let totalReelsCompleted = 0;
  
  this.weeks.forEach(week => {
    // Count completed posts per week
    const staticPosts = week.posts?.filter(post => post.type === 'static').length || 0;
    const reelPosts = week.posts?.filter(post => post.type === 'reel').length || 0;
    
    // Calculate completed (cannot exceed target)
    week.staticCompleted = Math.min(staticPosts, week.staticTarget || 0);
    week.reelsCompleted = Math.min(reelPosts, week.reelsTarget || 0);
    
    // Calculate week progress
    const weekTotalTarget = (week.staticTarget || 0) + (week.reelsTarget || 0);
    const weekTotalCompleted = week.staticCompleted + week.reelsCompleted;
    week.weekProgress = weekTotalTarget > 0 ? (weekTotalCompleted / weekTotalTarget) * 100 : 0;
    
    totalStaticCompleted += week.staticCompleted;
    totalReelsCompleted += week.reelsCompleted;
  });
  
  this.totalStaticCompleted = totalStaticCompleted;
  this.totalReelsCompleted = totalReelsCompleted;
  
  return { totalStaticCompleted, totalReelsCompleted };
};

// Method to calculate overall progress
weeklyReportSchema.methods.calculateProgress = function() {
  const totalTarget = this.totalStaticTarget + this.totalReelsTarget;
  const totalCompleted = this.totalStaticCompleted + this.totalReelsCompleted;
  this.overallProgress = totalTarget > 0 ? (totalCompleted / totalTarget) * 100 : 0;
  return this.overallProgress;
};

// Method to get week by number
weeklyReportSchema.methods.getWeek = function(weekNumber) {
  return this.weeks.find(w => w.weekNumber === weekNumber);
};

// Method to add or update week
weeklyReportSchema.methods.updateWeek = function(weekNumber, weekData) {
  const weekIndex = this.weeks.findIndex(w => w.weekNumber === weekNumber);
  
  if (weekIndex === -1) {
    // Add new week
    this.weeks.push({
      weekNumber,
      ...weekData,
      posts: weekData.posts || []
    });
  } else {
    // Update existing week
    this.weeks[weekIndex] = { ...this.weeks[weekIndex], ...weekData };
  }
  
  this.calculateTotals();
  this.calculateCompleted();
  this.calculateProgress();
};

module.exports = mongoose.model('WeeklyReport', weeklyReportSchema);