// controllers/eventController.js
const Event = require("../models/Event");
const { sendAlert } = require("./alertController");

// CREATE NEW EVENT
exports.createEvent = async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      user: req.user._id,
      role: req.user.role,
    };

    if (!eventData.accountId) eventData.accountId = null;
    if (!eventData.serviceId) eventData.serviceId = null;

    let event = await Event.create(eventData);

    event = await Event.findById(event._id)
      .populate("accountId", "name logo businessName")
      .populate("serviceId", "title icon serviceName");

    // 🔔 Alert: event created
    await sendAlert({
      userId: req.user._id,
      message: `Event created: ${event.title || "Untitled Event"}`,
      type: "Event",
      refId: event._id,
    });

    return res.status(201).json({ success: true, event });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET ALL EVENTS OF LOGGED USER
exports.getEvents = async (req, res) => {
  try {
    const events = await Event.find({ user: req.user._id })
      .populate("accountId", "name logo businessName")
      .populate("serviceId", "title icon serviceName")
      .sort({ start: 1 });

    return res.json({ success: true, events });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE EVENT
exports.updateEvent = async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      accountId: req.body.accountId || null,
      serviceId: req.body.serviceId || null,
    };

    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updateData,
      { new: true }
    )
      .populate("accountId", "name logo businessName")
      .populate("serviceId", "title icon serviceName");

    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });

    // 🔔 Alert: event updated
    await sendAlert({
      userId: req.user._id,
      message: `Event updated: ${event.title || "Untitled Event"}`,
      type: "Event",
      refId: event._id,
    });

    return res.json({ success: true, event });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE EVENT
exports.deleteEvent = async (req, res) => {
  try {
    const result = await Event.deleteOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (result.deletedCount === 0)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });

    // 🔔 Alert: event deleted
    await sendAlert({
      userId: req.user._id,
      message: `Event deleted`,
      type: "Event",
    });

    return res.json({ success: true, message: "Event deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
