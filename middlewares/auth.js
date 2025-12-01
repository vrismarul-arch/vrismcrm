const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 1. Check for token presence and format
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token missing" });
  }

  // 2. Extract token from "Bearer <token>"
  const token = authHeader.split(" ")[1];

  try {
    // 3. Verify the token using the secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Attach user data (ID and role) to the request object
    req.user = {
      _id: decoded.userId,
      role: decoded.role,
    };

    // 5. Proceed to the next middleware/controller function
    next();
  } catch (err) {
    // 6. Handle invalid or expired token
    return res
      .status(403)
      .json({ error: "Invalid or expired token" });
  }
};