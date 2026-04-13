const mongoose = require('mongoose');

const weekSchema = new mongoose.Schema({
  weekNumber: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  staticTarget: {
    type: Number,
    default: 0,
    min: 0
  },
  staticDelivered: {
    type: Number,
    default: 0,
    min: 0
  },
  reelsTarget: {
    type: Number,
    default: 0,
    min: 0
  },
  reelsDelivered: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  },
  notes: {
    type: String,
    default: ''
  }
});

const monthlyContentSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessAccount',
      required: true
    },
    businessName: {
      type: String,
      required: true
    },
    month: {
      type: String,
      required: true,
      default: () => {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
    },
    
    // Content counts
    staticPosts: {
      type: Number,
      default: 0,
      min: 0
    },
    reels: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Delivered counts
    deliveredStatic: {
      type: Number,
      default: 0,
      min: 0
    },
    deliveredReels: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Weekly tracking
    weeks: {
      type: [weekSchema],
      default: () => {
        return [1, 2, 3, 4, 5].map(weekNum => ({
          weekNumber: weekNum,
          staticTarget: 0,
          staticDelivered: 0,
          reelsTarget: 0,
          reelsDelivered: 0,
          status: 'pending',
          notes: ''
        }));
      }
    },
    
    // Status tracking
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'on-hold'],
      default: 'pending'
    },
    
    // History tracking
    history: [
      {
        date: { type: Date, default: Date.now },
        staticPosts: Number,
        reels: Number,
        deliveredStatic: Number,
        deliveredReels: Number,
        weeks: [weekSchema],
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        note: String
      }
    ],
    
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Virtuals
monthlyContentSchema.virtual('pendingStatic').get(function() {
  return Math.max(0, this.staticPosts - this.deliveredStatic);
});

monthlyContentSchema.virtual('pendingReels').get(function() {
  return Math.max(0, this.reels - this.deliveredReels);
});

monthlyContentSchema.virtual('totalDelivered').get(function() {
  return this.deliveredStatic + this.deliveredReels;
});

monthlyContentSchema.virtual('totalPlanned').get(function() {
  return this.staticPosts + this.reels;
});

monthlyContentSchema.virtual('completionPercentage').get(function() {
  const total = this.totalPlanned;
  if (total === 0) return 0;
  return Math.round((this.totalDelivered / total) * 100);
});

monthlyContentSchema.virtual('weeklyProgress').get(function() {
  if (!this.weeks || this.weeks.length === 0) return 0;
  const completedWeeks = this.weeks.filter(w => w.status === 'completed').length;
  return Math.round((completedWeeks / this.weeks.length) * 100);
});

// Method to recalculate from weeks
monthlyContentSchema.methods.recalculateFromWeeks = function() {
  if (!this.weeks || this.weeks.length === 0) return;
  
  const totals = this.weeks.reduce((acc, week) => ({
    staticPosts: acc.staticPosts + (week.staticTarget || 0),
    deliveredStatic: acc.deliveredStatic + (week.staticDelivered || 0),
    reels: acc.reels + (week.reelsTarget || 0),
    deliveredReels: acc.deliveredReels + (week.reelsDelivered || 0)
  }), { staticPosts: 0, deliveredStatic: 0, reels: 0, deliveredReels: 0 });
  
  this.staticPosts = totals.staticPosts;
  this.deliveredStatic = totals.deliveredStatic;
  this.reels = totals.reels;
  this.deliveredReels = totals.deliveredReels;
  
  // Update week statuses
  this.weeks.forEach(week => {
    const weekTotalTarget = (week.staticTarget || 0) + (week.reelsTarget || 0);
    const weekTotalDelivered = (week.staticDelivered || 0) + (week.reelsDelivered || 0);
    
    if (weekTotalTarget === 0) {
      week.status = 'pending';
    } else if (weekTotalDelivered >= weekTotalTarget) {
      week.status = 'completed';
    } else if (weekTotalDelivered > 0) {
      week.status = 'in-progress';
    } else {
      week.status = 'pending';
    }
  });
  
  // Update overall status
  const totalPlanned = this.totalPlanned;
  const totalDelivered = this.totalDelivered;
  
  if (totalPlanned === 0) {
    this.status = 'pending';
  } else if (totalDelivered >= totalPlanned) {
    this.status = 'completed';
  } else if (totalDelivered > 0) {
    this.status = 'active';
  } else {
    this.status = 'pending';
  }
};

// Pre-save middleware
monthlyContentSchema.pre('save', function(next) {
  if (this.weeks && this.weeks.length > 0) {
    this.recalculateFromWeeks();
  }
  this.lastUpdated = new Date();
  next();
});

// Indexes
monthlyContentSchema.index({ clientId: 1, month: 1 }, { unique: true });
monthlyContentSchema.index({ businessName: 1 });
monthlyContentSchema.index({ status: 1 });
monthlyContentSchema.index({ lastUpdated: -1 });
monthlyContentSchema.index({ month: 1 });

module.exports = mongoose.model('MonthlyContent', monthlyContentSchema);