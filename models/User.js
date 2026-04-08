// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  mobile: { type: String, trim: true },
  password: { type: String, required: true },
  profileImage: { type: String, default: null },
  
  // 🆕 Date of Birth field
  dob: { 
    type: Date, 
    default: null,
    validate: {
      validator: function(value) {
        if (!value) return true;
        const age = new Date().getFullYear() - new Date(value).getFullYear();
        return age >= 18 && age <= 100;
      },
      message: "User must be between 18 and 100 years old"
    }
  },
  
  role: {
    type: String,
    enum: ["Superadmin", "Admin", "Team Leader", "Employee", "Client"],
    default: "Employee",
  },

  businessAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BusinessAccount",
    default: null,
  },

  fcmToken: { type: String },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active",
  },

  presence: {
    type: String,
    enum: ["online", "offline", "busy", "away", "in_meeting"],
    default: "offline",
  },

  previousPresence: {
    type: String,
    enum: ["online", "offline", "busy", "away", "in_meeting", null],
    default: "offline",
  },

  lastSeen: { type: Date, default: null },
  lastActiveAt: { type: Date, default: Date.now },
  lastMessageAt: { type: Date, default: null },

  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
  team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
}, { timestamps: true });

// 🆕 Virtual field to calculate age
userSchema.virtual('age').get(function() {
  if (!this.dob) return null;
  const today = new Date();
  const birthDate = new Date(this.dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// 🆕 Virtual field to check if birthday is today
userSchema.virtual('isBirthdayToday').get(function() {
  if (!this.dob) return false;
  const today = new Date();
  const birthDate = new Date(this.dob);
  return today.getDate() === birthDate.getDate() && 
         today.getMonth() === birthDate.getMonth();
});

// Ensure virtuals are included in JSON output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("User", userSchema);