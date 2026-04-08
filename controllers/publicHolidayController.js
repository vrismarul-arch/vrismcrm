// ============================================================
// controllers/publicHolidayController.js
// ============================================================
const PublicHoliday = require('../models/PublicHoliday');
 
const ADMIN_ROLES = ['Admin', 'Superadmin', 'admin', 'superadmin'];
 
// ── GET all ──────────────────────────────────────────────────────────────────
exports.getAllHolidays = async (req, res) => {
  try {
    const { year, month, type, state } = req.query;
    const query = { isActive: true };
 
    if (year)  query.year  = parseInt(year);
    if (month) query.month = month;
    if (type)  query.type  = type;
    if (state) query.state = state;
 
    const holidays = await PublicHoliday.find(query)
      .populate('createdBy', 'name email')
      .sort({ date: 1 });
 
    res.json({ success: true, count: holidays.length, data: holidays });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
 
// ── GET by ID ─────────────────────────────────────────────────────────────────
exports.getHolidayById = async (req, res) => {
  try {
    const holiday = await PublicHoliday.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
 
    if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' });
    res.json({ success: true, data: holiday });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
 
// ── GET summary / stats ───────────────────────────────────────────────────────
exports.getHolidaySummary = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
 
    const [holidays, byType, byMonth] = await Promise.all([
      PublicHoliday.find({ year, isActive: true }).sort({ date: 1 }),
      PublicHoliday.aggregate([
        { $match: { year, isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      PublicHoliday.aggregate([
        { $match: { year, isActive: true } },
        { $group: { _id: '$month', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
 
    res.json({
      success: true,
      data: {
        year,
        total:           holidays.length,
        weekdayHolidays: holidays.filter(h => !h.isWeekend).length,
        weekendHolidays: holidays.filter(h =>  h.isWeekend).length,
        byType:  byType.reduce((a, t) => ({ ...a, [t._id]: t.count }), {}),
        byMonth: byMonth.reduce((a, m) => ({ ...a, [m._id]: m.count }), {}),
        holidays,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
 
// ── CREATE ────────────────────────────────────────────────────────────────────
exports.createHoliday = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can create holidays' });
    }
 
    const { name, date, type, state } = req.body;
    if (!name || !date || !type) {
      return res.status(400).json({ success: false, message: 'name, date, and type are required' });
    }
 
    // Duplicate check
    const existing = await PublicHoliday.findOne({ date: new Date(date) });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A holiday already exists on this date: "${existing.name}"`,
      });
    }
 
    const holiday = new PublicHoliday({
      name, type,
      date:  new Date(date),
      state: state || 'Tamil Nadu',
      createdBy: req.user._id,
    });
 
    await holiday.save();
    res.status(201).json({ success: true, message: 'Holiday created successfully', data: holiday });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
 
// ── UPDATE ────────────────────────────────────────────────────────────────────
exports.updateHoliday = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can update holidays' });
    }
 
    const holiday = await PublicHoliday.findById(req.params.id);
    if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' });
 
    const { name, date, type, state, isActive } = req.body;
 
    if (name)              holiday.name     = name;
    if (type)              holiday.type     = type;
    if (state)             holiday.state    = state;
    if (isActive !== undefined) holiday.isActive = isActive;
    if (date) {
      const conflict = await PublicHoliday.findOne({ date: new Date(date), _id: { $ne: holiday._id } });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: `Another holiday already exists on this date: "${conflict.name}"`,
        });
      }
      holiday.date = new Date(date);
    }
 
    holiday.updatedBy = req.user._id;
    await holiday.save();
 
    res.json({ success: true, message: 'Holiday updated successfully', data: holiday });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
 
// ── DELETE ────────────────────────────────────────────────────────────────────
exports.deleteHoliday = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can delete holidays' });
    }
 
    const holiday = await PublicHoliday.findByIdAndDelete(req.params.id);
    if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' });
 
    res.json({ success: true, message: 'Holiday deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
 
// ── BULK IMPORT from Excel (parsed on frontend, sent as JSON array) ────────────
exports.bulkImport = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can import holidays' });
    }
 
    const { holidays } = req.body; // [{ name, date, type, state }]
 
    if (!Array.isArray(holidays) || holidays.length === 0) {
      return res.status(400).json({ success: false, message: 'No holidays provided' });
    }
 
    const results = { created: 0, skipped: 0, failed: 0, errors: [] };
 
    for (const h of holidays) {
      try {
        if (!h.name || !h.date || !h.type) {
          results.errors.push({ name: h.name, issue: 'Missing required field' });
          results.failed++;
          continue;
        }
 
        const existing = await PublicHoliday.findOne({ date: new Date(h.date) });
        if (existing) {
          results.errors.push({ name: h.name, issue: `Date conflict with "${existing.name}"` });
          results.skipped++;
          continue;
        }
 
        const holiday = new PublicHoliday({
          name:  h.name,
          date:  new Date(h.date),
          type:  h.type,
          state: h.state || 'Tamil Nadu',
          createdBy: req.user._id,
        });
 
        await holiday.save();
        results.created++;
      } catch (err) {
        results.errors.push({ name: h.name, issue: err.message });
        results.failed++;
      }
    }
 
    res.status(201).json({
      success: true,
      message: `Import complete: ${results.created} created, ${results.skipped} skipped, ${results.failed} failed`,
      data: results,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
 
// ── SEED Tamil Nadu 2026 ─────────────────────────────────────────────────────
exports.seedHolidays = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
 
    const tamilNadu2026 = [
      { name: "New Year's Day",       date: '2026-01-01', type: 'National'  },
      { name: 'Bhogi',                date: '2026-01-14', type: 'Regional'  },
      { name: 'Pongal',               date: '2026-01-15', type: 'Regional'  },
      { name: 'Thiruvalluvar Day',    date: '2026-01-16', type: 'Regional'  },
      { name: 'Republic Day',         date: '2026-01-26', type: 'National'  },
      { name: "Tamil New Year's Day", date: '2026-04-14', type: 'Regional'  },
      { name: 'Independence Day',     date: '2026-08-15', type: 'National'  },
      { name: 'Vinayakar Chathurthi', date: '2026-09-14', type: 'Religious' },
      { name: 'Gandhi Jayanthi',      date: '2026-10-02', type: 'National'  },
      { name: 'Ayutha Pooja',         date: '2026-10-19', type: 'Religious' },
      { name: 'Vijaya Dasami',        date: '2026-10-20', type: 'Religious' },
      { name: 'Deepavali',            date: '2026-11-08', type: 'Religious' },
    ];
 
    let created = 0, skipped = 0;
 
    for (const h of tamilNadu2026) {
      const exists = await PublicHoliday.findOne({ date: new Date(h.date) });
      if (exists) { skipped++; continue; }
 
      const holiday = new PublicHoliday({ ...h, date: new Date(h.date), state: 'Tamil Nadu', createdBy: req.user._id });
      await holiday.save();
      created++;
    }
 
    res.status(201).json({
      success: true,
      message: `Seeded ${created} holidays, skipped ${skipped} duplicates`,
      data: { created, skipped },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
 