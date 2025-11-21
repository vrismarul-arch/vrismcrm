const mongoose = require("mongoose");

// Define the WorkSession schema
const workSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },           // User ID who is working
  name: { type: String, required: true },             // User's name
  email: { type: String, required: true },            // User's email
  loginTime: { type: Date, required: true },          // Session login time
  logoutTime: { type: Date },                         // Session logout time
  totalHours: { type: Number, default: 0 },           // Total hours worked
  eod: { type: String, default: "" },                // End-of-day notes
  date: { type: Date, default: Date.now },            // Session date
  accountIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "BusinessAccount" }],  // Linked accounts
  serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "BrandService" }],    // Linked services
});

// Export the model
module.exports = mongoose.model("WorkSession", workSessionSchema);
