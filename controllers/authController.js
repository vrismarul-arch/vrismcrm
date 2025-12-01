const User = require("../models/User"); // Assumes a Mongoose User model
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
//
exports.login = async (req, res) => {
  // 1. Get credentials from request body
  const { username, password } = req.body;

  try {
    // 2. Find user by email (used as username)
    const user = await User.findOne({ email: username });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" }); // User not found
    }

    // 3. Compare provided plain-text password with stored hash
    //    (This is the key step using bcrypt)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" }); // Password mismatch
    }

    // 4. Generate JWT on successful match
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET, // JWT_SECRET should be defined in environment variables
      { expiresIn: "2d" } // Token expires in 2 days
    );

    // 5. Prepare user object for client (remove password hash)
    const userObj = user.toObject();
    delete userObj.password;

    // 6. Send token and user data
    res.json({
      token,
      user: userObj,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
};