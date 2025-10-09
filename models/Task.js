const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  // Reference to the User model
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // Reference to the BusinessAccount model
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessAccount" }, 
  // Reference to the BrandService model
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "BrandService" },    
  status: { 
    type: String, 
    enum: ["To Do", "In Progress", "Review", "Completed", "Overdue"], // ⬅️ UPDATED
    default: "To Do" 
  },
  assignedDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  attachments: [{ type: String }],
}, { 
  timestamps: true // Adds createdAt and updatedAt fields
});

module.exports = mongoose.model("Task", taskSchema);