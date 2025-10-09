const mongoose = require('mongoose');

// Note schema for internal remarks or client-specific notes
const noteSchema = new mongoose.Schema({
  text: { type: String },
  timestamp: { type: String },
  author: { type: String }
}, { _id: false });

// Option schema for packages or campaign variations
const optionSchema = new mongoose.Schema({
  type: { type: String, required: false },       // e.g., "Social Media Package", "Email Campaign"
  description: { type: String, required: false }, // Short detail of the package/option
  price: { type: Number, required: false },       // Optional custom price for each package
  duration: { type: Number, required: false }     // Duration in days or hours
}, { _id: false });

// Main Brand Service Schema
const brandServiceSchema = new mongoose.Schema({
  service_id: { type: String, required: true, unique: true },
  serviceName: { type: String, required: true },      // e.g., "Instagram Promotion"
  category: { type: String, required: false },       // e.g., "Social Media", "Brand Campaign"
  description: { type: String },
  basePrice: { type: Number, required: false },      // base cost for the service
  duration: { type: Number, required: false },       // duration in days/hours
  options: [optionSchema],                            // variations/packages
  notes: [noteSchema],                                // internal/admin notes
  isActive: { type: Boolean, default: true },        // active/inactive
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: false },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: false },
  hsnSac: { type: String },                           // tax code if applicable
  gstRate: { type: Number, default: 0 },             // GST percentage
}, { timestamps: true });

module.exports = mongoose.model('BrandService', brandServiceSchema);
