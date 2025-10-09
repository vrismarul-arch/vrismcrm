const Team = require('../models/Team');
const User = require('../models/User');
const Department = require('../models/Department');

// Helper to update user's team and department fields
const updateUserTeamAndDepartment = async (userId, teamId = null, departmentId = null) => {
  if (!userId) return;
  try {
    const update = { team: teamId, department: departmentId };
    await User.findByIdAndUpdate(userId, update, { new: true });
  } catch (error) {
    console.error(`Error updating user ${userId}:`, error.message);
  }
};

// Create Team
exports.createTeam = async (req, res) => {
  try {
    const { name, department, teamLeader, members } = req.body;

    const existingDepartment = await Department.findById(department);
    if (!existingDepartment) {
      return res.status(400).json({ message: 'Department not found.' });
    }

    if (teamLeader) {
      const leader = await User.findById(teamLeader);
      if (!leader) return res.status(400).json({ message: 'Team Leader not found.' });
      if (leader.role !== 'Team Leader')
        return res.status(400).json({ message: 'Assigned user is not a Team Leader.' });

      const existingTeamWithLeader = await Team.findOne({ teamLeader });
      if (existingTeamWithLeader)
        return res.status(400).json({ message: 'This user is already a Team Leader for another team.' });
    }

    const newTeam = await Team.create({ name, department, teamLeader, members });

    if (teamLeader) await updateUserTeamAndDepartment(teamLeader, newTeam._id, department);
    for (const memberId of members || []) {
      await updateUserTeamAndDepartment(memberId, newTeam._id, department);
    }

    res.status(201).json(newTeam);
  } catch (err) {
    console.error("Error in createTeam:", err);
    res.status(400).json({ error: err.message });
  }
};

// Get All Teams
exports.getAllTeams = async (req, res) => {
  try {
    const teams = await Team.find()
      .populate('department', 'name')
      .populate('teamLeader', 'name email')
      .populate('members', 'name email')
      .sort({ name: 1 });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Single Team
exports.getSingleTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('department', 'name')
      .populate('teamLeader', 'name email')
      .populate('members', 'name email');
    if (!team) return res.status(404).json({ message: 'Team not found' });
    res.json(team);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Update Team
exports.updateTeam = async (req, res) => {
  try {
    const { name, department, teamLeader, members } = req.body;
    const teamId = req.params.id;

    const originalTeam = await Team.findById(teamId);
    if (!originalTeam) return res.status(404).json({ message: 'Team not found' });

    if (department && department.toString() !== originalTeam.department.toString()) {
      const existingDepartment = await Department.findById(department);
      if (!existingDepartment) return res.status(400).json({ message: 'Department not found.' });
    }

    const currentLeaderId = originalTeam.teamLeader ? originalTeam.teamLeader.toString() : null;
    const newLeaderId = teamLeader ? teamLeader.toString() : null;

    if (newLeaderId && newLeaderId !== currentLeaderId) {
      const leader = await User.findById(newLeaderId);
      if (!leader) return res.status(400).json({ message: 'Team Leader not found.' });
      if (leader.role !== 'Team Leader')
        return res.status(400).json({ message: 'Assigned user is not a Team Leader.' });
      const existingTeamWithLeader = await Team.findOne({ teamLeader: newLeaderId, _id: { $ne: teamId } });
      if (existingTeamWithLeader)
        return res.status(400).json({ message: 'This user is already a Team Leader for another team.' });
    }

    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      { name, department, teamLeader: newLeaderId, members: members || [] },
      { new: true, runValidators: true }
    );

    const resolvedDepartmentId = department || originalTeam.department;

    if (currentLeaderId && currentLeaderId !== newLeaderId) {
      await updateUserTeamAndDepartment(currentLeaderId, null, null);
    }
    if (newLeaderId) {
      await updateUserTeamAndDepartment(newLeaderId, updatedTeam._id, resolvedDepartmentId);
    }

    const originalMemberIds = originalTeam.members.map(String);
    const newMemberIds = (members || []).map(String);

    for (const originalMemberId of originalMemberIds) {
      if (!newMemberIds.includes(originalMemberId)) {
        await updateUserTeamAndDepartment(originalMemberId, null, null);
      }
    }

    for (const newMemberId of newMemberIds) {
      const user = await User.findById(newMemberId);
      if (!user || user.team?.toString() !== updatedTeam._id.toString()) {
        await updateUserTeamAndDepartment(newMemberId, updatedTeam._id, resolvedDepartmentId);
      }
    }

    res.json(updatedTeam);
  } catch (err) {
    console.error("Error in updateTeam:", err);
    res.status(400).json({ error: err.message });
  }
};

// Delete Team
exports.deleteTeam = async (req, res) => {
  try {
    const teamId = req.params.id;
    const deletedTeam = await Team.findByIdAndDelete(teamId);

    if (!deletedTeam) return res.status(404).json({ message: 'Team not found' });
z
    if (deletedTeam.teamLeader) {
      await updateUserTeamAndDepartment(deletedTeam.teamLeader, null, null);
    }
    for (const memberId of deletedTeam.members) {
      await updateUserTeamAndDepartment(memberId, null, null);
    }

    res.json({ message: 'Team deleted successfully' });
  } catch (err) {
    console.error("Error in deleteTeam:", err);
    res.status(400).json({ error: err.message });
  }
};
