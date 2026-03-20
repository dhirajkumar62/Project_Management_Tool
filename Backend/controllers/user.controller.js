const User = require("../models/User.model");

/* ============== GET ALL USERS (ADMIN) ============== */
exports.getAllUsers = async (req, res) => {
  try {
    console.log("GET /api/users called by user:", req.user.id);
    const users = await User.find({}, "-password")
      .select("_id username email role isVerified status createdAt")
      .sort({ createdAt: -1 });

    console.log("Returning", users.length, "users");
    res.json({
      total: users.length,
      users: users
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
};

/* ============== GET USER STATISTICS ============== */
exports.getUserStats = async (req, res) => {
  try {
    console.log("GET /api/users/stats called");
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const admins = await User.countDocuments({ role: "admin" });
    const regularUsers = await User.countDocuments({ role: "user" });

    const stats = {
      totalUsers,
      verifiedUsers,
      admins,
      regularUsers,
      unverifiedUsers: totalUsers - verifiedUsers
    };
    
    console.log("Returning stats:", stats);
    res.json(stats);
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ message: "Failed to fetch user statistics", error: error.message });
  }
};

/* ============== UPDATE USER ROLE (ADMIN) ============== */
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select("-password");

    res.json({
      message: "User role updated successfully",
      user
    });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({ message: "Failed to update user role" });
  }
};

/* ============== DELETE USER (ADMIN) ============== */
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    await User.findByIdAndDelete(userId);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
};

/* ============== BLOCK / ACTIVATE USER (ADMIN) ============== */
exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!["active", "blocked"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Prevent blocking yourself
    if (userId === req.user.id && status === "blocked") {
      return res.status(400).json({ message: "Cannot block your own account" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    ).select("-password");

    res.json({
      message: `User ${status === "blocked" ? "blocked" : "activated"} successfully`,
      user
    });
  } catch (error) {
    console.error("Toggle user status error:", error);
    res.status(500).json({ message: "Failed to update user status" });
  }
};

/* ============== GET USER DETAILS WITH STATS ============== */
exports.getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const Project = require("../models/Project.model");
    const Task = require("../models/Task.model");

    const user = await User.findById(userId).select("-password");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's projects
    const projectCount = await Project.countDocuments({
      $or: [
        { owner: userId },
        { "members.userId": userId }
      ]
    });

    // Get user's tasks
    const userTasks = await Task.find({ assignedTo: userId });
    const completedTasks = userTasks.filter(t => t.status === "completed").length;
    const completionRate = userTasks.length > 0 
      ? Math.round((completedTasks / userTasks.length) * 100)
      : 0;

    res.json({
      user,
      stats: {
        projectCount,
        totalTasks: userTasks.length,
        completedTasks,
        completionRate
      }
    });
  } catch (error) {
    console.error("Get user details error:", error);
    res.status(500).json({ message: "Failed to fetch user details" });
  }
};
