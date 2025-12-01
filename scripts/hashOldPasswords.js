const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "../.env")
});

console.log("DEBUG ENV MONGO_URI =", process.env.MONGO_URI);

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const connectDB = require("../config/db");

(async () => {
  await connectDB();

  const users = await User.find();
  for (const user of users) {
    if (!user.password.startsWith("$2b$")) {
      console.log("🔄 Hashing:", user.email);
      user.password = await bcrypt.hash(user.password, 10);
      await user.save();
    }
  }

  console.log("🎯 Hashing completed!");
  mongoose.disconnect();
  process.exit(0);
})();
