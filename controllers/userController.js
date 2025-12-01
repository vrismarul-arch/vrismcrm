// controllers/userController.js
const User = require("../models/User");
const Team = require("../models/Team");
const Department = require("../models/Department");
const bcrypt = require("bcryptjs");

/**
 * Helper: update user team & department (kept for compatibility)
 */
const updateUserTeamAndDepartment = async (
  userId,
  teamId = null,
  departmentId = null
) => {
  if (!userId) return;
  try {
    await User.findByIdAndUpdate(
      userId,
      { team: teamId, department: departmentId },
      { new: true }
    );
  } catch (err) {
    console.error(`Error updating user ${userId}:`, err.message);
  }
};

/**
 * Get all users
 * Optional query: ?type=eod to filter only EOD-relevant roles
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { type } = req.query;
    let filter = {};

    if (type === "eod") {
      filter = {
        role: {
          $in: [
            "Employee",
            "Team Leader",
            "TeamLeader",
            "employee",
            "team_lead",
          ],
        },
      };
    }

    const users = await User.find(filter)
      .populate("department", "name")
      .populate("team", "name")
      .sort({ createdAt: -1 })
      .select("-password"); // 🚫 don't send password

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get single user by ID
 */
exports.getSingleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("department", "name")
      .populate("team", "name")
      .select("-password"); // 🚫 no password

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid User ID format" });
    }
    res.status(500).json({ error: err.message });
  }
};

/**
 * Create User (with password hashing)
 */
exports.createUser = async (req, res) => {
  try {
    const { password, ...rest } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // 🔐 Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      ...rest,
      password: hashedPassword,
    });

    const userObj = newUser.toObject();
    delete userObj.password; // 🚫 never send hash out

    res.status(201).json(userObj);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: "A user with this email already exists." });
    }
    res.status(400).json({ error: err.message });
  }
};

/**
 * Update User (hash password if provided, otherwise keep existing)
 */
exports.updateUser = async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (updateData.password) {
      // 🔐 hash only if a new password is provided
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      // do not overwrite existing password with undefined
      delete updateData.password;
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("department", "name")
      .populate("team", "name")
      .select("-password"); // 🚫 no password

    if (!updated) return res.status(404).json({ message: "User not found" });

    res.json(updated);
  } catch (err) {
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid User ID format" });
    }
    res.status(400).json({ error: err.message });
  }
};

/**
 * Delete User
 */
exports.deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser)
      return res.status(404).json({ message: "User not found" });

    res.json({ message: "User deleted" });
  } catch (err) {
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid User ID format" });
    }
    res.status(400).json({ error: err.message });
  }
};

/**
 * Transfer User between departments/teams/zones
 */
exports.transferUser = async (req, res) => {
  try {
    const { id: userId } = req.params;
    const { newDepartmentId, newTeamId, newZoneId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const originalTeamId = user.team ? user.team.toString() : null;

    // Remove from old team
    if (originalTeamId && originalTeamId !== newTeamId) {
      const originalTeam = await Team.findById(originalTeamId);
      if (originalTeam) {
        originalTeam.members = originalTeam.members.filter(
          (m) => m.toString() !== userId
        );
        if (
          originalTeam.teamLeader &&
          originalTeam.teamLeader.toString() === userId
        ) {
          originalTeam.teamLeader = null;
        }
        await originalTeam.save();
      }
    }

    let resolvedDepartmentId = newDepartmentId || null;

    // Add to new team
    if (newTeamId) {
      const newTeam = await Team.findById(newTeamId);
      if (!newTeam)
        return res.status(400).json({ message: "New team not found." });

      resolvedDepartmentId = newTeam.department;

      if (!newTeam.members.includes(userId)) {
        newTeam.members.push(userId);
      }

      if (user.role === "Team Leader" && !newTeam.teamLeader) {
        newTeam.teamLeader = userId;
      }

      await newTeam.save();
    }

    await User.findByIdAndUpdate(userId, {
      team: newTeamId || null,
      department: resolvedDepartmentId,
      zone: newZoneId || null,
    });

    const updatedUser = await User.findById(userId)
      .populate("team", "name")
      .populate("department", "name")
      .select("-password");

    res.json({ message: "User transferred successfully", user: updatedUser });
  } catch (err) {
    console.error("Transfer error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * WhatsApp-style sorted chat users
 * Sort by: lastMessageAt, then lastActiveAt
 */
exports.getChatSortedUsers = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const users = await User.find({ _id: { $ne: userId } })
      .sort({
        lastMessageAt: -1,
        lastActiveAt: -1,
      })
      .select(
        "name email presence lastSeen lastActiveAt lastMessageAt"
      ); // already safe

    res.json(users);
  } catch (err) {
    console.error("Chat list fetch error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Update presence / status (online, offline, busy, away, in_meeting)
 */
exports.updateStatus = async (req, res) => {
  try {
    const { userId, presence } = req.body;

    if (!userId || !presence) {
      return res
        .status(400)
        .json({ message: "userId & presence required" });
    }

    const valid = ["online", "offline", "busy", "away", "in_meeting"];
    if (!valid.includes(presence)) {
      return res
        .status(400)
        .json({ message: "Invalid presence value" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const previousPresence = user.presence;

    const updateFields = {
      presence,
      previousPresence,
    };

    // Update lastActiveAt only when active
    if (["online", "busy", "in_meeting"].includes(presence)) {
      updateFields.lastActiveAt = new Date();
    }

    // Update lastSeen only when leaving
    if (["offline", "away"].includes(presence)) {
      updateFields.lastSeen = new Date();
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, {
      new: true,
    }).select("-password"); // 🚫 no password

    // Broadcast to all connected clients via Socket.io
    if (global._io) {
      global._io.emit("presence_updated", {
        userId,
        presence,
        previousPresence,
        lastSeen: updatedUser.lastSeen,
        lastActiveAt: updatedUser.lastActiveAt,
      });
    }

    res.json({ message: "Presence updated", user: updatedUser });
  } catch (err) {
    console.error("Presence update error:", err);
    res.status(500).json({ error: err.message });
  }
};
