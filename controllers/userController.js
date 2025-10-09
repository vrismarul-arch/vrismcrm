const User = require('../models/User');
const Team = require('../models/Team');
const Department = require('../models/Department');

// Helper: update user team & department
const updateUserTeamAndDepartment = async (userId, teamId = null, departmentId = null) => {
    if (!userId) return;
    try {
        const update = { team: teamId, department: departmentId };
        await User.findByIdAndUpdate(userId, update, { new: true });
    } catch (error) {
        console.error(`Error updating user ${userId}:`, error.message);
    }
};

// @desc    Get all users (Admin view or filtered)
exports.getAllUsers = async (req, res) => {
    try {
        const { type } = req.query;
        let filter = {};

        // 🔹 If used in EOD report — return Employees & TeamLeads only
        if (type === "eod") {
            filter = { role: { $in: ["Employee", "Team Lead", "TeamLeader", "employee", "team_lead"] } };
        }

        const users = await User.find(filter)
            .populate("department", "name")
            .populate("team", "name")
            .sort({ createdAt: -1 });

        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Get a single user by ID
exports.getSingleUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate("department", "name")
            .populate("team", "name");

        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (err) {
        if (err.kind === "ObjectId") {
            return res.status(400).json({ message: "Invalid User ID format" });
        }
        res.status(500).json({ error: err.message });
    }
};

// @desc    Create new user
exports.createUser = async (req, res) => {
    try {
        const newUser = await User.create(req.body);
        res.status(201).json(newUser);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: "A user with this email already exists." });
        }
        res.status(400).json({ error: err.message });
    }
};

// @desc    Update existing user
exports.updateUser = async (req, res) => {
    try {
        const updated = await User.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!updated) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(updated);
    } catch (err) {
        if (err.kind === "ObjectId") {
            return res.status(400).json({ message: "Invalid User ID format" });
        }
        res.status(400).json({ error: err.message });
    }
};

// @desc    Delete a user
exports.deleteUser = async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ message: "User deleted" });
    } catch (err) {
        if (err.kind === "ObjectId") {
            return res.status(400).json({ message: "Invalid User ID format" });
        }
        res.status(400).json({ error: err.message });
    }
};

// @desc    Transfer user to a new team, department, and zone
exports.transferUser = async (req, res) => {
    try {
        const { id: userId } = req.params;
        const { newDepartmentId, newTeamId, newZoneId } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found." });

        const originalTeamId = user.team ? user.team.toString() : null;

        // 1️⃣ Remove from old team
        if (originalTeamId && originalTeamId !== newTeamId) {
            const originalTeam = await Team.findById(originalTeamId);
            if (originalTeam) {
                originalTeam.members = originalTeam.members.filter(
                    (memberId) => memberId.toString() !== userId
                );
                if (originalTeam.teamLeader && originalTeam.teamLeader.toString() === userId) {
                    originalTeam.teamLeader = null;
                }
                await originalTeam.save();
            }
        }

        // 2️⃣ Add to new team
        let resolvedDepartmentId = newDepartmentId || null;
        if (newTeamId) {
            const newTeam = await Team.findById(newTeamId);
            if (!newTeam) {
                return res.status(400).json({ message: "New team not found." });
            }
            resolvedDepartmentId = newTeam.department;
            if (!newTeam.members.includes(userId)) {
                newTeam.members.push(userId);
            }
            if (user.role === "Team Leader" && !newTeam.teamLeader) {
                newTeam.teamLeader = userId;
            }
            await newTeam.save();
        }

        // 3️⃣ Update user's document
        await User.findByIdAndUpdate(userId, {
            team: newTeamId,
            department: resolvedDepartmentId,
            zone: newZoneId || null,
        });

        const updatedUser = await User.findById(userId)
            .populate("team", "name")
            .populate("department", "name");

        res.json({ message: "User transferred successfully", user: updatedUser });
    } catch (err) {
        console.error("Transfer error:", err);
        res.status(500).json({ error: err.message });
    }
};
