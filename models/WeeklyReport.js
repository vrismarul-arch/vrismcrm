const mongoose = require("mongoose");

// Schema for individual post/reel details
const contentItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: "",
    },
    link: {
      type: String,
      trim: true,
      default: "",
    },
    postedDate: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const weeklyDataSchema = new mongoose.Schema(
  {
    weekNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    target: {
      statics: { 
        type: Number, 
        default: 0, 
        min: 0,
      },
      reels: { 
        type: Number, 
        default: 0, 
        min: 0,
      },
    },
    posted: {
      statics: { 
        type: Number, 
        default: 0, 
        min: 0,
      },
      reels: { 
        type: Number, 
        default: 0, 
        min: 0,
      },
      posts: {
        type: [contentItemSchema],
        default: [],
      },
      reelsList: {
        type: [contentItemSchema],
        default: [],
      },
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
  },
  { _id: false }
);

const weeklyReportSchema = new mongoose.Schema(
  {
    businessAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessAccount",
      required: [true, "Business account is required"],
    },
    month: {
      type: String,
      required: [true, "Month is required"],
    },
    weeklyData: {
      type: [weeklyDataSchema],
      required: [true, "Weekly data is required"],
    },
    totalPosted: {
      statics: { type: Number, default: 0, min: 0 },
      reels: { type: Number, default: 0, min: 0 },
    },
    totalTarget: {
      statics: { type: Number, default: 0, min: 0 },
      reels: { type: Number, default: 0, min: 0 },
    },
    percentageAchieved: {
      statics: { 
        type: Number, 
        default: 0, 
        min: 0, 
        max: 100,
      },
      reels: { 
        type: Number, 
        default: 0, 
        min: 0, 
        max: 100,
      },
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for overall achievement
weeklyReportSchema.virtual("overallAchievement").get(function() {
  return parseFloat((((this.percentageAchieved?.statics || 0) + 
                      (this.percentageAchieved?.reels || 0)) / 2).toFixed(1));
});

// Pre-save middleware to ensure calculations
weeklyReportSchema.pre("save", function(next) {
  let totalPostedStatics = 0;
  let totalPostedReels = 0;
  let totalTargetStatics = 0;
  let totalTargetReels = 0;

  this.weeklyData.forEach((week) => {
    // Auto-set posted counts from arrays if they exist
    if (week.posted.posts && week.posted.posts.length > 0) {
      week.posted.statics = week.posted.posts.length;
    }
    if (week.posted.reelsList && week.posted.reelsList.length > 0) {
      week.posted.reels = week.posted.reelsList.length;
    }
    
    totalPostedStatics += week.posted?.statics || 0;
    totalPostedReels += week.posted?.reels || 0;
    totalTargetStatics += week.target?.statics || 0;
    totalTargetReels += week.target?.reels || 0;
  });

  this.totalPosted = {
    statics: totalPostedStatics,
    reels: totalPostedReels,
  };

  this.totalTarget = {
    statics: totalTargetStatics,
    reels: totalTargetReels,
  };

  this.percentageAchieved = {
    statics: totalTargetStatics ? parseFloat(((totalPostedStatics / totalTargetStatics) * 100).toFixed(1)) : 0,
    reels: totalTargetReels ? parseFloat(((totalPostedReels / totalTargetReels) * 100).toFixed(1)) : 0,
  };

  next();
});

const WeeklyReport = mongoose.model("WeeklyReport", weeklyReportSchema);

module.exports = WeeklyReport;