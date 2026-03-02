const mongoose = require('mongoose');

const monthlyContentSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessAccount',
      required: true,
      unique: true
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
    
    // Status tracking
    status: {
      type: String,
      enum: ['active', 'completed', 'pending'],
      default: 'active'
    },
    
    // History tracking
    history: [
      {
        date: { type: Date, default: Date.now },
        staticPosts: Number,
        reels: Number,
        deliveredStatic: Number,
        deliveredReels: Number,
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
    }
  },
  {
    timestamps: true
  }
);

// Virtual for pending calculations
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

// Indexes for better query performance
monthlyContentSchema.index({ clientId: 1, month: 1 }, { unique: true });
monthlyContentSchema.index({ businessName: 1 });
monthlyContentSchema.index({ status: 1 });
monthlyContentSchema.index({ lastUpdated: -1 });

module.exports = mongoose.model('MonthlyContent', monthlyContentSchema);