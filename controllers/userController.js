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
        "name email presence lastSeen lastActiveAt lastMessageAt profileImage"
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
// controllers/userController.js (Add these new functions)

/**
 * 🆕 Get users with birthdays today
 */
exports.getBirthdayUsers = async (req, res) => {
  try {
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();

    const users = await User.find({
      dob: { $ne: null },
      status: "Active"
    })
      .populate("department", "name")
      .populate("team", "name")
      .select("name email profileImage dob role team department");

    const birthdayUsers = users.filter(user => {
      if (!user.dob) return false;
      const birthDate = new Date(user.dob);
      return birthDate.getMonth() === todayMonth && 
             birthDate.getDate() === todayDay;
    });

    // Add age calculation for each user
    const birthdayUsersWithAge = birthdayUsers.map(user => {
      const userObj = user.toObject();
      const age = calculateAge(user.dob);
      return { ...userObj, age };
    });

    res.json({
      success: true,
      count: birthdayUsersWithAge.length,
      users: birthdayUsersWithAge,
      message: birthdayUsersWithAge.length > 0 ? "🎂 Happy Birthday!" : "No birthdays today",
      date: today.toISOString().split('T')[0]
    });
  } catch (err) {
    console.error("Error fetching birthday users:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * 🆕 Get upcoming birthdays (next 7 days)
 */
exports.getUpcomingBirthdays = async (req, res) => {
  try {
    const { days = 7 } = req.query; // Default to 7 days
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + parseInt(days));

    const users = await User.find({
      dob: { $ne: null },
      status: "Active"
    })
      .populate("department", "name")
      .populate("team", "name")
      .select("name email profileImage dob role team department");

    const upcomingBirthdays = users.filter(user => {
      if (!user.dob) return false;
      const birthDate = new Date(user.dob);
      const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
      
      // If birthday already passed this year, check for next year
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(today.getFullYear() + 1);
      }
      
      return thisYearBirthday >= today && thisYearBirthday <= futureDate;
    }).sort((a, b) => {
      const aDate = new Date(today.getFullYear(), new Date(a.dob).getMonth(), new Date(a.dob).getDate());
      const bDate = new Date(today.getFullYear(), new Date(b.dob).getMonth(), new Date(b.dob).getDate());
      
      // Adjust for next year if birthday passed
      if (aDate < today) aDate.setFullYear(today.getFullYear() + 1);
      if (bDate < today) bDate.setFullYear(today.getFullYear() + 1);
      
      return aDate - bDate;
    });

    // Add days until birthday and age
    const upcomingBirthdaysWithDetails = upcomingBirthdays.map(user => {
      const userObj = user.toObject();
      const birthDate = new Date(user.dob);
      const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
      
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(today.getFullYear() + 1);
      }
      
      const daysUntil = Math.ceil((thisYearBirthday - today) / (1000 * 60 * 60 * 24));
      const age = calculateAge(user.dob);
      const turningAge = age + (thisYearBirthday.getFullYear() - new Date(user.dob).getFullYear());
      
      return { 
        ...userObj, 
        age,
        turningAge,
        daysUntil,
        birthdayDate: thisYearBirthday.toISOString().split('T')[0]
      };
    });

    res.json({
      success: true,
      count: upcomingBirthdaysWithDetails.length,
      daysRange: parseInt(days),
      users: upcomingBirthdaysWithDetails,
      message: upcomingBirthdaysWithDetails.length > 0 ? `${upcomingBirthdaysWithDetails.length} upcoming birthdays` : "No upcoming birthdays"
    });
  } catch (err) {
    console.error("Error fetching upcoming birthdays:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * 🆕 Get users by age range
 */
exports.getUsersByAgeRange = async (req, res) => {
  try {
    const { minAge = 18, maxAge = 100 } = req.query;
    
    const currentYear = new Date().getFullYear();
    const minBirthYear = currentYear - maxAge;
    const maxBirthYear = currentYear - minAge;
    
    const users = await User.find({
      dob: { 
        $ne: null,
        $gte: new Date(minBirthYear, 0, 1),
        $lte: new Date(maxBirthYear, 11, 31)
      },
      status: "Active"
    })
      .populate("department", "name")
      .populate("team", "name")
      .select("name email profileImage dob role team department");

    const usersWithAge = users.map(user => {
      const userObj = user.toObject();
      userObj.age = calculateAge(user.dob);
      return userObj;
    }).sort((a, b) => a.age - b.age);

    res.json({
      success: true,
      count: usersWithAge.length,
      ageRange: { min: parseInt(minAge), max: parseInt(maxAge) },
      users: usersWithAge
    });
  } catch (err) {
    console.error("Error fetching users by age range:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * 🆕 Get birthday statistics
 */
exports.getBirthdayStats = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const users = await User.find({
      dob: { $ne: null },
      status: "Active"
    }).select("dob name email role");

    // Group birthdays by month
    const monthlyStats = {};
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    
    monthNames.forEach(month => {
      monthlyStats[month] = [];
    });

    users.forEach(user => {
      const birthDate = new Date(user.dob);
      const monthName = monthNames[birthDate.getMonth()];
      const age = calculateAge(user.dob);
      
      monthlyStats[monthName].push({
        name: user.name,
        email: user.email,
        role: user.role,
        day: birthDate.getDate(),
        age
      });
    });

    // Sort each month's birthdays by day
    Object.keys(monthlyStats).forEach(month => {
      monthlyStats[month].sort((a, b) => a.day - b.day);
    });

    const totalBirthdays = users.length;
    const birthdaysThisMonth = monthlyStats[monthNames[new Date().getMonth()]].length;
    
    // Calculate average age
    const totalAge = users.reduce((sum, user) => sum + calculateAge(user.dob), 0);
    const averageAge = totalBirthdays > 0 ? (totalAge / totalBirthdays).toFixed(1) : 0;

    res.json({
      success: true,
      year,
      totalUsers: totalBirthdays,
      birthdaysThisMonth,
      averageAge: parseFloat(averageAge),
      monthlyBreakdown: monthlyStats,
      monthNames
    });
  } catch (err) {
    console.error("Error fetching birthday stats:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * 🆕 Check if today is specific user's birthday
 */
exports.checkUserBirthday = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select("name email dob profileImage role");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    if (!user.dob) {
      return res.json({
        success: true,
        isBirthday: false,
        message: "User has not set date of birth",
        user: { name: user.name, email: user.email, dob: null }
      });
    }
    
    const today = new Date();
    const birthDate = new Date(user.dob);
    const isBirthday = today.getDate() === birthDate.getDate() && 
                       today.getMonth() === birthDate.getMonth();
    
    const age = calculateAge(user.dob);
    const nextBirthday = isBirthday ? null : getNextBirthday(user.dob);
    
    res.json({
      success: true,
      isBirthday,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        role: user.role,
        dob: user.dob,
        age
      },
      nextBirthday,
      message: isBirthday ? `🎉 Happy Birthday ${user.name}! 🎂` : `${user.name}'s birthday is not today`
    });
  } catch (err) {
    console.error("Error checking user birthday:", err);
    res.status(500).json({ error: err.message });
  }
};

// Helper function to calculate age
const calculateAge = (dob) => {
  if (!dob) return null;
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Helper function to get next birthday
const getNextBirthday = (dob) => {
  if (!dob) return null;
  const today = new Date();
  const birthDate = new Date(dob);
  const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  
  if (nextBirthday < today) {
    nextBirthday.setFullYear(today.getFullYear() + 1);
  }
  
  const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
  
  return {
    date: nextBirthday.toISOString().split('T')[0],
    daysUntil,
    willTurn: calculateAge(dob) + 1
  };
};