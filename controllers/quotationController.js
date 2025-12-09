// quotationController.js
const Quotation = require('../models/Quotation');
const Business = require('../models/BusinessAccount'); // Ensure BusinessAccount is imported if used by getActiveBusinesses

// GET all quotations
exports.getAll = async (req, res) => {
  try {
    const quotations = await Quotation.find().sort({ createdAt: -1 }); // Fetch all quotations, sorted by creation date descending
    res.json(quotations);
  } catch (err) {
    console.error("Error fetching all quotations:", err); // Log the detailed error for debugging
    res.status(500).json({ error: 'Failed to fetch quotations. Please try again later.' }); // More informative error for client
  }
};

// POST create a quotation with auto-generated quotation number
exports.create = async (req, res) => {
  try {
    // Find the last quotation to determine the next sequential number
    const lastQuotation = await Quotation.findOne().sort({ createdAt: -1 });
    let nextNumber = "Q-0001"; // Default starting quotation number

    if (lastQuotation && lastQuotation.quotationNumber) {
      // Extract the numeric part, increment it, and reformat with leading zeros
      const lastNumber = parseInt(lastQuotation.quotationNumber.split('-')[1], 10);
      const newNumber = lastNumber + 1;
      nextNumber = `Q-${String(newNumber).padStart(4, '0')}`;
    }

    // Create a new Quotation instance with data from request body and generated number
    const newQuotation = new Quotation({
      ...req.body,
      quotationNumber: nextNumber
    });

    // Save the new quotation to the database
    const saved = await newQuotation.save();
    res.status(201).json(saved); // Respond with the created quotation and 201 Created status
  } catch (err) {
    // Handle specific MongoDB duplicate key error (error code 11000)
    if (err.code === 11000) {
        console.error("Duplicate quotation number attempt or race condition:", err); // Log the specific error
        return res.status(409).json({ error: 'A quotation with this number was just created. Please try generating a new one or refresh.' });
    }
    // Handle other validation or database errors
    console.error("Error creating quotation:", err); // Log the detailed error for debugging
    res.status(400).json({ error: 'Failed to create quotation. Please check your input and try again.' });
  }
};

// PUT update a quotation
exports.update = async (req, res) => {
  try {
    // Find the quotation by ID and update it. 'new: true' returns the updated document.
    const updated = await Quotation.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); // runValidators to ensure schema validation on update
    if (!updated) {
      return res.status(404).json({ error: 'Quotation not found.' }); // If no quotation found for the ID
    }
    res.json(updated); // Respond with the updated quotation
  } catch (err) {
    console.error("Error updating quotation:", err); // Log the detailed error for debugging
    res.status(400).json({ error: 'Failed to update quotation. Please check your input.' });
  }
};

// DELETE a quotation
exports.remove = async (req, res) => {
  try {
    // Find the quotation by ID and delete it
    const deleted = await Quotation.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Quotation not found.' }); // If no quotation found for the ID
    }
    res.json({ message: "Quotation deleted successfully." }); // Respond with success message
  } catch (err) {
    console.error("Error deleting quotation:", err); // Log the detailed error for debugging
    res.status(400).json({ error: 'Failed to delete quotation.' });
  }
};

// GET active businesses
exports.getActiveBusinesses = async (req, res) => {
  try {
    // Ensure BusinessAccount model is imported if this function is used.
    // If not, you might need to import it here or move this function.
    // const BusinessAccount = require('../models/BusinessAccount'); // Uncomment if needed
    const businesses = await Business.find({ status: 'Customer' }); // Find businesses with 'Active' status
    res.json(businesses);
  } catch (err) {
    console.error("Error fetching active businesses:", err); // Log the detailed error for debugging
    res.status(500).json({ error: 'Failed to fetch active businesses.' });
  }
};

// GET quotations by business ID
exports.getQuotationsByBusinessId = async (req, res) => {
  try {
    // Find quotations that belong to a specific businessId
    const quotations = await Quotation.find({ businessId: req.params.id });
    res.json(quotations);
  } catch (err) {
    console.error("Error fetching quotations by business ID:", err); // Log the detailed error for debugging
    res.status(500).json({ message: 'Failed to fetch quotations for the specified business.' });
  }
};

// --- NEW FOLLOW-UP ENDPOINTS FOR QUOTATIONS ---

// Get follow-ups by quotation ID
exports.getFollowUpsByQuotationId = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('followUps.addedBy', 'name email'); // Populate user details if 'addedBy' is a ref to User

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found.' });
    }
    res.json(quotation.followUps || []);
  } catch (err) {
    console.error("Error fetching follow-ups for quotation:", err);
    res.status(500).json({ message: 'Failed to fetch follow-ups.', error: err.message });
  }
};

// Add a follow-up to a quotation
// In quotationController.js

// Add a new follow-up to a specific quotation
exports.addFollowUp = async (req, res) => {
  const { id } = req.params;
  // Destructure 'status' from req.body
  const { date, note, addedBy, status } = req.body;

  try {
    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    // Create new follow-up object including status
    const newFollowUp = { date, note, addedBy, status }; // Make sure 'status' is included here
    quotation.followUps.push(newFollowUp);
    await quotation.save();

    // After saving, re-fetch to get populated 'addedBy' if needed for response
    const updatedQuotation = await Quotation.findById(id)
      .populate('followUps.addedBy', 'name email');

    res.status(200).json({ message: 'Follow-up added successfully.', followUps: updatedQuotation.followUps });
  } catch (err) {
    console.error("Error adding follow-up to quotation:", err);
    res.status(500).json({ message: 'Failed to add follow-up.', error: err.message });
  }
};

// Update a specific follow-up by its index on a quotation
exports.updateFollowUp = async (req, res) => {
  try {
    const { id, index } = req.params;
    // Destructure 'status' from req.body
    const { date, note, status } = req.body;

    const quotation = await Quotation.findById(id);
    if (!quotation || !quotation.followUps[index]) {
      return res.status(404).json({ message: 'Follow-up not found.' });
    }

    quotation.followUps[index].date = date;
    quotation.followUps[index].note = note;
    // Update the status
    quotation.followUps[index].status = status;
    await quotation.save();

    // After saving, re-fetch to get populated 'addedBy' if needed for response
    const updatedQuotation = await Quotation.findById(id)
        .populate('followUps.addedBy', 'name email');

    res.status(200).json({ message: 'Follow-up updated successfully.', followUps: updatedQuotation.followUps });
  } catch (err) {
    console.error("Error updating follow-up on quotation:", err);
    res.status(500).json({ message: 'Failed to update follow-up.', error: err.message });
  }
};
// Delete a follow-up by index on a quotation
exports.deleteFollowUp = async (req, res) => {
  try {
    const { id, index } = req.params; // id is Quotation ID

    const quotation = await Quotation.findById(id);
    if (!quotation || !quotation.followUps[index]) {
      return res.status(404).json({ message: 'Follow-up not found.' });
    }

    quotation.followUps.splice(index, 1); // Remove item from array
    await quotation.save();

    // After saving, re-fetch to get populated 'addedBy' if needed for response
    const updatedQuotation = await Quotation.findById(id)
        .populate('followUps.addedBy', 'name email');

    res.status(200).json({ message: 'Follow-up deleted successfully.', followUps: updatedQuotation.followUps });
  } catch (err) {
    console.error("Error deleting follow-up from quotation:", err);
    res.status(500).json({ message: 'Failed to delete follow-up.', error: err.message });
  }
};
