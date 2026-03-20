const User = require("../models/User.model");
const Project = require("../models/Project.model");
const Activity = require("../models/Activity.model");
const Task = require("../models/Task.model");

// Get all users with their statistics
exports.getAllUsers = async (req, res) => {
  try {
    const { search, role, status, sort = "createdAt", limit = 20, page = 1 } = req.query;

    let filter = {};

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    if (role && role !== "all") {
      filter.role = role;
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let sortObj = {};
    if (sort === "activity") {
      sortObj = { updatedAt: -1 };
    } else if (sort === "newest") {
      sortObj = { createdAt: -1 };
    } else {
      sortObj = { [sort]: -1 };
    }

    const users = await User.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "projects",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$owner", "$$userId"] },
                    { $in: ["$$userId", "$members.userId"] }
                  ]
                }
              }
            }
          ],
          as: "projects"
        }
      },
      {
        $lookup: {
          from: "activities",
          localField: "_id",
          foreignField: "userId",
          as: "activities"
        }
      },
      {
        $addFields: {
          projectCount: { $size: "$projects" },
          activityCount: { $size: "$activities" }
        }
      },
      {
        $project: {
          _id: 1,
          username: 1,
          email: 1,
          role: 1,
          status: 1,
          isVerified: 1,
          projectCount: 1,
          activityCount: 1,
          createdAt: 1,
          updatedAt: 1,
          lastLogin: "$updatedAt"
        }
      },
      { $sort: sortObj },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    const total = await User.countDocuments(filter);

    res.json({
      users,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users", error: error.message });
  }
};

// Get single user details with all stats
exports.getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const projects = await Project.find({
      $or: [
        { owner: userId },
        { "members.userId": userId }
      ]
    });

    const tasks = await Task.find({ assignedTo: userId });

    const recentActivities = await Activity.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      user,
      stats: {
        projectCount: projects.length,
        taskCount: tasks.length,
        completedTasks: tasks.filter(t => t.status === "completed").length,
        ownedProjects: projects.filter(p => p.owner.toString() === userId).length,
        recentActivities
      }
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Error fetching user details", error: error.message });
  }
};

// Change user role
exports.changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role: role },
      { new: true }
    );

    // Log activity
    await Activity.create({
      userId: req.user.id,
      type: "user_role_changed",
      title: `Changed ${user.username}'s role to ${role}`,
      description: `Admin changed user role to ${role}`,
      metadata: { userId, newRole: role }
    });

    res.json({ message: "User role updated", user });
  } catch (error) {
    console.error("Error changing user role:", error);
    res.status(500).json({ message: "Error changing user role", error: error.message });
  }
};

// Deactivate user account
exports.deactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { status: "blocked" },
      { new: true }
    );

    // Log activity
    await Activity.create({
      userId: req.user.id,
      type: "user_deactivated",
      title: `Deactivated user ${user.username}`,
      description: reason || "Account deactivated by admin",
      metadata: { userId, reason }
    });

    res.json({ message: "User deactivated", user });
  } catch (error) {
    console.error("Error deactivating user:", error);
    res.status(500).json({ message: "Error deactivating user", error: error.message });
  }
};

// Activate user account
exports.activateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { status: "active" },
      { new: true }
    );

    // Log activity
    await Activity.create({
      userId: req.user.id,
      type: "user_activated",
      title: `Activated user ${user.username}`,
      description: "Account reactivated by admin",
      metadata: { userId }
    });

    res.json({ message: "User activated", user });
  } catch (error) {
    console.error("Error activating user:", error);
    res.status(500).json({ message: "Error activating user", error: error.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reassignProjects = false } = req.body || {};

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If reassigning, transfer projects to requesting admin
    if (reassignProjects) {
      await Project.updateMany(
        { owner: userId },
        { owner: req.user.id }
      );
    } else {
      // Delete all projects owned by this user
      await Project.deleteMany({ owner: userId });
    }

    // Delete all activities related to this user
    await Activity.deleteMany({ userId });

    // Delete the user
    await User.findByIdAndDelete(userId);

    // Log activity
    await Activity.create({
      userId: req.user.id,
      type: "user_deleted",
      title: `Deleted user ${user.username}`,
      description: `User account and associated data deleted. Projects ${reassignProjects ? "transferred" : "deleted"}.`,
      metadata: { userId, reassignProjects }
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Error deleting user", error: error.message });
  }
};

// Get user statistics dashboard
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: "admin" });
    const regularUsers = await User.countDocuments({ role: "user" });
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const unverifiedUsers = totalUsers - verifiedUsers;

    res.json({
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      admins: adminUsers,
      regularUsers
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ message: "Error fetching user stats", error: error.message });
  }
};
