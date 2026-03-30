const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  try {
    console.log("LOGIN BODY:", req.body); // 🔍 debug once

    // ✅ Accept BOTH email & username (PRO FLEXIBLE FIX)
    const { email, username, password } = req.body;
    const loginId = email || username;

    // ✅ Validation
    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/Username and password are required"
      });
    }

    // ✅ Find user
    const user = await User.findOne({ email: loginId });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // ✅ Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // ✅ Generate token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2d" }
    );

    // ✅ Remove password
    const userObj = user.toObject();
    delete userObj.password;

    // ✅ Response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: userObj
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};