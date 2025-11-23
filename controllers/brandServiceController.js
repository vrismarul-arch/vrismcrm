const BrandService = require('../models/BrandService'); // Updated model
const { v4: uuidv4 } = require('uuid'); // For generating unique service IDs
//
// GET all services
exports.getAllServices = async (req, res) => {
  try {
    const services = await BrandService.find().sort({ createdAt: -1 });
    res.json(services);
  } catch (err) {
    console.error("Error fetching all services:", err);
    res.status(500).json({ error: 'Failed to fetch services. Please try again later.' });
  }
};

// GET one service by ID
exports.getServiceById = async (req, res) => {
  try {
    const service = await BrandService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found.' });
    }
    res.json(service);
  } catch (err) {
    console.error("Error fetching service by ID:", err);
    res.status(500).json({ error: 'Failed to fetch service.' });
  }
};

// POST create a new service
exports.createService = async (req, res) => {
  try {
    // Generate a unique service_id
    const newServiceId = uuidv4();
    const newService = new BrandService({
      ...req.body,
      service_id: newServiceId
    });
    const savedService = await newService.save();
    res.status(201).json(savedService);
  } catch (err) {
    console.error("Error creating service:", err);
    res.status(400).json({ error: 'Failed to create service. Please check your input.' });
  }
};

// PUT update a service
exports.updateService = async (req, res) => {
  try {
    const updatedService = await BrandService.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedService) {
      return res.status(404).json({ error: 'Service not found.' });
    }
    res.json(updatedService);
  } catch (err) {
    console.error("Error updating service:", err);
    res.status(400).json({ error: 'Failed to update service. Please check your input.' });
  }
};

// DELETE a service
exports.deleteService = async (req, res) => {
  try {
    const deletedService = await BrandService.findByIdAndDelete(req.params.id);
    if (!deletedService) {
      return res.status(404).json({ error: 'Service not found.' });
    }
    res.json({ message: "Service deleted successfully." });
  } catch (err) {
    console.error("Error deleting service:", err);
    res.status(400).json({ error: 'Failed to delete service.' });
  }
};

// PUT update service notes
exports.updateServiceNotes = async (req, res) => {
  try {
    const { notes } = req.body; // notes array from request body
    const updatedService = await BrandService.findByIdAndUpdate(
      req.params.id,
      { notes: notes }, // Update only the notes field
      { new: true, runValidators: true }
    );
    if (!updatedService) {
      return res.status(404).json({ error: 'Service not found.' });
    }
    res.json(updatedService);
  } catch (err) {
    console.error("Error updating service notes:", err);
    res.status(400).json({ error: 'Failed to update service notes.' });
  }
};
