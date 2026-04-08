// ============================================================
// routes/publicHolidayRoutes.js
// ============================================================
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/publicHolidayController');
const auth    = require('../middlewares/auth');
 
router.use(auth);
 
// Summary
router.get('/summary', ctrl.getHolidaySummary);
 
// Seed TN 2026
router.post('/seed', ctrl.seedHolidays);
 
// Bulk import (Excel rows sent as JSON)
router.post('/bulk-import', ctrl.bulkImport);
 
// CRUD
router.route('/')
  .get(ctrl.getAllHolidays)
  .post(ctrl.createHoliday);
 
router.route('/:id')
  .get(ctrl.getHolidayById)
  .put(ctrl.updateHoliday)
  .delete(ctrl.deleteHoliday);
 
module.exports = router;