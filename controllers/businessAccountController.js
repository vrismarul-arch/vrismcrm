const BusinessAccount = require('../models/BusinessAccount');
const Quotation = require('../models/Quotation'); // Ensures Quotation model is loaded
const User = require('../models/User'); // Ensures User model is loaded
const mongoose = require('mongoose');

// Helper function for common population fields
const populateOptions = [
    { path: 'assignedTo', select: 'name role' },
    { path: 'followUps.addedBy', select: 'name' },
    // **CORRECTED REFERENCE**
    { path: 'selectedService', select: 'serviceName price', model: 'BrandService' } 
];

// Get all accounts (Leads + Customers)
exports.getAll = async (req, res) => {
    try {
        const accounts = await BusinessAccount.find().populate(populateOptions);
        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get paginated and filtered accounts (Leads + Customers)
exports.getPaginatedAccounts = async (req, res) => {
    try {
        const { page = 1, pageSize = 10, search = '', status, sortBy = 'createdAt', sortOrder = 'desc', userId, role} = req.query;

        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        let query = {};

        // Apply role-based filtering for Employees
        if (role === "Employee" && userId) {
            query.assignedTo = userId;
        }

        // Apply status filter if provided
        if (status && status !== 'all') {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { businessName: { $regex: search, $options: 'i' } },
                { contactName: { $regex: search, $options: 'i' } }
            ];
        }

        const total = await BusinessAccount.countDocuments(query);

        const accounts = await BusinessAccount.find(query)
            .populate(populateOptions)
            .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            data: accounts,
            total,
            page: parseInt(page),
            pageSize: parseInt(pageSize)
        });
    } catch (err) {
        console.error('Error in getPaginatedAccounts:', err);
        res.status(500).json({ error: err.message || 'Server error fetching paginated accounts' });
    }
};

// Get aggregated counts for all account statuses
exports.getAccountCounts = async (req, res) => {
    try {
        let matchQuery = {};
        
        // Apply user/role filter
        if (req.query.role === 'Employee' && req.query.userId) {
            matchQuery.assignedTo = new mongoose.Types.ObjectId(req.query.userId);
        }
        
        // Add TargetLeads to the aggregation
        const counts = await BusinessAccount.aggregate([
            { $match: matchQuery }, 
            {
                $facet: {
                    all: [{ $count: 'total' }],
                    active: [{ $match: { status: 'Active' } }, { $count: 'total' }],
                    Pipeline: [{ $match: { status: 'Pipeline' } }, { $count: 'total' }],
                    quotations: [{ $match: { status: 'Quotations' } }, { $count: 'total' }],
                    customers: [{ $match: { status: 'Customer' } }, { $count: 'total' }],
                    closed: [{ $match: { status: 'Closed' } }, { $count: 'total' }],
                    targetLeads: [{ $match: { status: 'TargetLeads' } }, { $count: 'total' }], 
                },
            },
            {
                $project: {
                    all: { $arrayElemAt: ['$all.total', 0] },
                    active: { $arrayElemAt: ['$active.total', 0] },
                    Pipeline: { $arrayElemAt: ['$Pipeline.total', 0] },
                    quotations: { $arrayElemAt: ['$quotations.total', 0] },
                    customers: { $arrayElemAt: ['$customers.total', 0] },
                    closed: { $arrayElemAt: ['$closed.total', 0] },
                    targetLeads: { $arrayElemAt: ['$targetLeads.total', 0] },
                },
            },
        ]);

        const formattedCounts = {
            all: counts[0]?.all || 0,
            active: counts[0]?.active || 0,
            Pipeline: counts[0]?.Pipeline || 0,
            quotations: counts[0]?.quotations || 0,
            customers: counts[0]?.customers || 0,
            closed: counts[0]?.closed || 0,
            targetLeads: counts[0]?.targetLeads || 0,
        };

        res.status(200).json(formattedCounts);
    } catch (error) {
        console.error('Error fetching account counts:', error);
        res.status(500).json({ message: 'Error fetching account counts', error: error.message });
    }
};

// Get leads by source type
exports.getLeadsBySource = async (req, res) => {
    try {
        const { sourceType } = req.params;
        const leads = await BusinessAccount.find({
            status: { $ne: 'Customer' },
            sourceType: sourceType
        }).populate(populateOptions);
        res.json(leads);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching leads by source', error: error.message });
    }
};

// Get only active leads (not customers)
exports.getActiveLeads = async (req, res) => {
    try {
        const leads = await BusinessAccount.find({ status: 'Active' })
            .populate(populateOptions);
        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get only customers
exports.getCustomers = async (req, res) => {
    try {
        const customers = await BusinessAccount.find({ status: 'Customer' })
            .populate(populateOptions);
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get business account by ID
exports.getAccountById = async (req, res) => {
    try {
        const account = await BusinessAccount.findById(req.params.id)
            .populate(populateOptions);
        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }
        res.json(account);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// CREATE business account
exports.create = async (req, res) => {
    try {
        const data = { ...req.body };

        // Check for existing businessName (case-insensitive)
        const existingAccount = await BusinessAccount.findOne({
            businessName: { $regex: new RegExp(`^${data.businessName}$`, 'i') }
        }).populate('assignedTo', 'name role');

        if (existingAccount) {
            return res.status(409).json({ 
                message: `An account with this business name already exists. It is currently assigned to ${existingAccount.assignedTo ? existingAccount.assignedTo.name : 'an unassigned user'}.`,
                existingAccount: existingAccount._id, 
                assignedTo: existingAccount.assignedTo ? {
                    name: existingAccount.assignedTo.name,
                    role: existingAccount.assignedTo.role
                } : null 
            });
        }

        // Set isCustomer flag
        data.isCustomer = data.status === 'Customer';

        const newAccount = new BusinessAccount(data);
        const savedAccount = await newAccount.save();
        const populatedAccount = await BusinessAccount.findById(savedAccount._id)
            .populate(populateOptions);
            
        res.status(201).json(populatedAccount);
    } catch (err) {
        console.error('Error creating business account:', err); 
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
        if (err.code === 11000) { // Mongoose duplicate key error (E11000)
             return res.status(409).json({ error: 'Business name already exists.', details: err.message });
        }
        res.status(500).json({ error: err.message });
    }
};

// UPDATE business account
exports.update = async (req, res) => {
    try {
        const data = { ...req.body };
        // Set isCustomer flag
        data.isCustomer = data.status === 'Customer';

        const updated = await BusinessAccount.findByIdAndUpdate(
            req.params.id,
            data,
            { new: true, runValidators: true }
        ).populate(populateOptions);

        if (!updated) {
            return res.status(404).json({ message: 'Account not found' });
        }
        res.json(updated);
    } catch (err) {
        console.error('Error updating business account:', err); 
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
        if (err.code === 11000) {
             return res.status(409).json({ error: 'Business name already exists.', details: err.message });
        }
        res.status(500).json({ error: err.message });
    }
};

exports.getQuotationsSent = async (req, res) => {
    try {
        const quotations = await BusinessAccount.find({ status: 'Quotations' })
            .populate(populateOptions);
        res.json(quotations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Soft DELETE business account (set status to 'Closed')
exports.delete = async (req, res) => {
    try {
        const account = await BusinessAccount.findById(req.params.id);
        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }

        account.status = 'Closed';
        account.isCustomer = false;
        await account.save();

        res.status(200).json({ message: 'Account status set to Closed', account });
    } catch (err) {
        console.error('Error in soft delete:', err);
        res.status(500).json({ error: err.message || 'Server error during status update' });
    }
};

// ADD note to an account
exports.addNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, timestamp, author } = req.body;
        const account = await BusinessAccount.findById(id);
        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }
        account.notes.push({ text, timestamp, author });
        await account.save();
        res.status(200).json({ message: 'Note added successfully', notes: account.notes });
    } catch (error) {
        res.status(500).json({ message: 'Failed to add note', error: error.message });
    }
};

// Quotation related functions (Stubs)
exports.addQuotation = async (req, res) => {
    res.status(501).json({ message: 'Add quotation not implemented yet.' });
};

exports.getQuotations = async (req, res) => {
    res.status(501).json({ message: 'Get quotations not implemented yet.' });
};

// GET follow-ups by account ID
exports.getFollowUpsByAccountId = async (req, res) => {
    try {
        const { id } = req.params;
        const account = await BusinessAccount.findById(id)
            .populate('followUps.addedBy', 'name');
        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }
        res.json(account.followUps);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching follow-ups', error: error.message });
    }
};

// ADD follow-up
exports.addFollowUp = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, note, addedBy, status } = req.body;
        const account = await BusinessAccount.findById(id);

        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }

        account.followUps.push({ date, note, addedBy, status });
        await account.save();

        res.status(201).json({ message: 'Follow-up added successfully', followUps: account.followUps });
    } catch (error) {
        res.status(500).json({ message: 'Failed to add follow-up', error: error.message });
    }
};

// UPDATE follow-up by index
exports.updateFollowUp = async (req, res) => {
    const { id, index } = req.params;
    const { date, note, status } = req.body;

    try {
        const account = await BusinessAccount.findById(id);
        const followUpIndex = parseInt(index); 

        if (!account || isNaN(followUpIndex) || !account.followUps[followUpIndex]) {
            return res.status(404).json({ message: 'Follow-up not found' });
        }

        account.followUps[followUpIndex].date = date;
        account.followUps[followUpIndex].note = note;
        account.followUps[followUpIndex].status = status;
        await account.save();

        res.status(200).json({ message: 'Follow-up updated', followUps: account.followUps });
    } catch (error) {
        res.status(500).json({ message: 'Error updating follow-up', error: error.message });
    }
};

// DELETE follow-up by index
exports.deleteFollowUp = async (req, res) => {
    const { id, index } = req.params;

    try {
        const account = await BusinessAccount.findById(id);
        const followUpIndex = parseInt(index); 

        if (!account || isNaN(followUpIndex) || !account.followUps[followUpIndex]) {
            return res.status(404).json({ message: 'Follow-up not found' });
        }

        account.followUps.splice(followUpIndex, 1);
        await account.save();

        res.status(200).json({ message: 'Follow-up deleted', followUps: account.followUps });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting follow-up', error: error.message });
    }
};
// BULK STATUS UPDATE (Convert Multiple Leads to Customer)
exports.bulkStatusUpdate = async (req, res) => {
    try {
        const { ids, status } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                message: "No account IDs provided",
            });
        }

        const updated = await BusinessAccount.updateMany(
            { _id: { $in: ids } },
            {
                $set: {
                    status,
                    isCustomer: status === "Customer" ? true : false
                }
            }
        );

        return res.status(200).json({
            message: "Bulk update successful",
            updatedCount: updated.modifiedCount,
        });

    } catch (error) {
        console.error("Bulk status update error:", error);
        res.status(500).json({
            message: "Error updating accounts",
            error: error.message
        });
    }
};
