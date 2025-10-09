const mongoose = require("mongoose");

const workSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  loginTime: { type: Date, required: true },
  logoutTime: { type: Date },
  totalHours: { type: Number, default: 0 },
  eod: { type: String, default: "" },
  date: { type: Date, default: Date.now },
  accountIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "BusinessAccount" }],
  serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "BrandService" }],
});
/*  */
module.exports = mongoose.model("WorkSession", WorkSessionSchema);
  