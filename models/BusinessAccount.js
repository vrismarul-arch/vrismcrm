const mongoose = require('mongoose');

// Embedded Schema for Notes
const noteSchema = new mongoose.Schema({
    text: { type: String, required: true },
    timestamp: { type: String, required: true },
    author: { type: String, required: true }
}, { _id: false });

// Embedded Schema for Follow-Ups
const followUpSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    note: { type: String, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

// Embedded Schema for Additional Contact Persons
const contactPersonSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String },
    phoneNumber: { type: String },
}, { _id: true });

// Main Business Account Schema
const businessAccountSchema = new mongoose.Schema({
    businessName: { type: String, required: true, unique: true },
    contactName: { type: String, required: true },
    contactEmail: { type: String },
    contactNumber: { type: String, required: true },
    primaryContactPersonName: { type: String },
    additionalContactPersons: [contactPersonSchema],
    gstNumber: { type: String },
    addressLine1: { type: String },
    addressLine2: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    pincode: { type: Number },
    website: { type: String },
    sourceType: { type: String, default: 'Direct' },
    typeOfLead: [{ type: String, enum: ['Regular', 'Government', 'Occupational', 'Revenue'] }],
    status: {
        type: String,
        enum: ['Active', 'Pipeline', 'Quotations', 'Customer', 'Closed', 'TargetLeads'],
        default: 'Active',
        required: true,
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // **CORRECTED REFERENCE**
    selectedService: { type: mongoose.Schema.Types.ObjectId, ref: 'BrandService' }, 
    totalPrice: { type: Number, default: 0 },
    notes: [noteSchema],
    followUps: [followUpSchema],
    quotations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' }],
    isCustomer: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// Pre-save hook to update updatedAt
businessAccountSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('BusinessAccount', businessAccountSchema);