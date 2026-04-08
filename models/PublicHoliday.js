const mongoose = require('mongoose');
 
const publicHolidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Holiday name is required'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    day: {
      type: String,
      enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    },
    month: { type: String },
    year:  { type: Number },
    type: {
      type: String,
      enum: ['National', 'Regional', 'Religious'],
      required: [true, 'Type is required'],
    },
    state:     { type: String, default: 'Tamil Nadu' },
    isWeekend: { type: Boolean, default: false },
    isActive:  { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
 
// Auto-compute day / month / year / isWeekend from date
publicHolidaySchema.pre('save', function (next) {
  const d    = new Date(this.date);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const mons = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
 
  this.day       = days[d.getDay()];
  this.month     = mons[d.getMonth()];
  this.year      = d.getFullYear();
  this.isWeekend = d.getDay() === 0 || d.getDay() === 6;
  next();
});
 
publicHolidaySchema.index({ date: 1 }, { unique: true });
publicHolidaySchema.index({ year: 1, month: 1 });
publicHolidaySchema.index({ type: 1 });
publicHolidaySchema.index({ state: 1, year: 1 });
 
module.exports = mongoose.model('PublicHoliday', publicHolidaySchema);