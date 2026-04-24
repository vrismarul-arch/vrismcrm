import express from 'express';
import mongoose from 'mongoose';
import WeeklyReport from '../models/WeeklyReport.js';

const router = express.Router();

// Get all reports with optional filters
router.get('/', async (req, res) => {
  try {
    const { clientId, month, year } = req.query;
    let filter = {};
    
    if (clientId) filter.clientId = clientId;
    if (month) filter.month = month;
    if (year) filter.year = parseInt(year);
    
    const reports = await WeeklyReport.find(filter)
      .populate('clientId', 'businessName contactName')
      .sort({ year: -1, month: -1 });
    
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single report by ID
router.get('/:id', async (req, res) => {
  try {
    const report = await WeeklyReport.findById(req.params.id)
      .populate('clientId', 'businessName contactName');
    
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create or update weekly report
router.post('/', async (req, res) => {
  try {
    const { clientId, month, year, weeks } = req.body;
    
    // Check if report exists for this client and month
    let report = await WeeklyReport.findOne({ clientId, month, year });
    
    if (report) {
      // Update existing report
      report.weeks = weeks;
      report.calculateTotals();
      await report.save();
    } else {
      // Create new report
      report = new WeeklyReport({
        clientId,
        month,
        year,
        weeks
      });
      report.calculateTotals();
      await report.save();
    }
    
    await report.populate('clientId', 'businessName contactName');
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update specific week in report
router.put('/:id/week/:weekNumber', async (req, res) => {
  try {
    const { id, weekNumber } = req.params;
    const { staticTarget, reelsTarget, posts } = req.body;
    
    const report = await WeeklyReport.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    
    const weekIndex = report.weeks.findIndex(w => w.weekNumber === parseInt(weekNumber));
    
    if (weekIndex === -1) {
      return res.status(404).json({ success: false, message: 'Week not found' });
    }
    
    // Update week data
    if (staticTarget !== undefined) report.weeks[weekIndex].staticTarget = staticTarget;
    if (reelsTarget !== undefined) report.weeks[weekIndex].reelsTarget = reelsTarget;
    if (posts !== undefined) report.weeks[weekIndex].posts = posts;
    
    // Recalculate totals
    report.calculateTotals();
    await report.save();
    
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add post to a week
router.post('/:id/week/:weekNumber/posts', async (req, res) => {
  try {
    const { id, weekNumber } = req.params;
    const { title, instagramLink, postedDate, notes, type } = req.body;
    
    const report = await WeeklyReport.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    
    const weekIndex = report.weeks.findIndex(w => w.weekNumber === parseInt(weekNumber));
    
    if (weekIndex === -1) {
      return res.status(404).json({ success: false, message: 'Week not found' });
    }
    
    const newPost = {
      title,
      instagramLink,
      postedDate: new Date(postedDate),
      notes,
      type
    };
    
    report.weeks[weekIndex].posts.push(newPost);
    await report.save();
    
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete post from week
router.delete('/:id/week/:weekNumber/posts/:postIndex', async (req, res) => {
  try {
    const { id, weekNumber, postIndex } = req.params;
    
    const report = await WeeklyReport.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    
    const weekIndex = report.weeks.findIndex(w => w.weekNumber === parseInt(weekNumber));
    
    if (weekIndex === -1) {
      return res.status(404).json({ success: false, message: 'Week not found' });
    }
    
    report.weeks[weekIndex].posts.splice(parseInt(postIndex), 1);
    await report.save();
    
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete entire report
router.delete('/:id', async (req, res) => {
  try {
    const report = await WeeklyReport.findByIdAndDelete(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get monthly summary for a client
router.get('/summary/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { year } = req.query;
    
    let filter = { clientId };
    if (year) filter.year = parseInt(year);
    
    const reports = await WeeklyReport.find(filter)
      .sort({ year: -1, month: 1 });
    
    const summary = reports.map(report => ({
      month: report.month,
      year: report.year,
      totalStaticTarget: report.totalStaticTarget,
      totalReelsTarget: report.totalReelsTarget,
      totalPosts: report.weeks.reduce((sum, week) => sum + week.posts.length, 0)
    }));
    
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;