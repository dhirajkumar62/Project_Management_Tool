const User = require("../models/User.model");
const Project = require("../models/Project.model");
const Task = require("../models/Task.model");
const Activity = require("../models/Activity.model");
const { redisClient } = require("../config/redis");

// Get global analytics dashboard data
exports.getDashboardAnalytics = async (req, res) => {
  try {
    // Check cache first
    const cacheKey = "analytics:dashboard";
    let cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // Get all analytics data
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: "admin" });
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const totalActiveUsers = await User.countDocuments({
      status: "active",
      updatedAt: { $gte: sevenDaysAgo }
    });

    const totalProjects = await Project.countDocuments();
    const activeProjects = await Project.countDocuments({
      status: { $in: ["planning", "in_progress"] }
    });
    const completedProjects = await Project.countDocuments({
      status: "completed"
    });

    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({
      status: "completed"
    });
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Task status breakdown
    const taskStatusBreakdown = await Task.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // User growth over last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const userGrowth = await User.aggregate([
      {
        $match: { createdAt: { $gte: thirtyDaysAgo } }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Project creation over last 30 days
    const projectGrowth = await Project.aggregate([
      {
        $match: { createdAt: { $gte: thirtyDaysAgo } }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Projects per status
    const projectsByStatus = await Project.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Top active users (by project count)
    const topActiveUsers = await User.aggregate([
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
        $addFields: {
          projectCount: { $size: "$projects" }
        }
      },
      {
        $match: { projectCount: { $gt: 0 } }
      },
      {
        $sort: { projectCount: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          username: 1,
          email: 1,
          projectCount: 1,
          lastLogin: { $ifNull: ["$updatedAt", null] }
        }
      }
    ]);

    const analyticsData = {
      summary: {
        totalUsers,
        totalAdmins,
        activeUsers: totalActiveUsers,
        totalProjects,
        activeProjects,
        completedProjects,
        totalTasks,
        completedTasks,
        completionRate,
        blockableUsers: totalUsers - totalActiveUsers
      },
      charts: {
        taskStatusBreakdown,
        userGrowth,
        projectGrowth,
        projectsByStatus,
        topActiveUsers
      }
    };

    // Cache for 10 minutes
    await redisClient.setEx(cacheKey, 600, JSON.stringify(analyticsData));

    res.json(analyticsData);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ message: "Error fetching analytics", error: error.message });
  }
};

// Get monthly project statistics
exports.getProjectStats = async (req, res) => {
  try {
    const cacheKey = "analytics:project-stats";
    let cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const lastTwelveMonths = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const projectsByMonth = await Project.aggregate([
      {
        $match: { createdAt: { $gte: lastTwelveMonths } }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" }
          },
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const stats = {
      monthly: projectsByMonth,
      averageCompletionTime: await Project.aggregate([
        {
          $match: { status: "completed", endDate: { $exists: true } }
        },
        {
          $addFields: {
            durationDays: {
              $divide: [
                { $subtract: ["$endDate", "$createdAt"] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            avgDays: { $avg: "$durationDays" }
          }
        }
      ])
    };

    await redisClient.setEx(cacheKey, 600, JSON.stringify(stats));

    res.json(stats);
  } catch (error) {
    console.error("Error fetching project stats:", error);
    res.status(500).json({ message: "Error fetching project stats", error: error.message });
  }
};

// Get recent activities
exports.getRecentActivities = async (req, res) => {
  try {
    const { limit = 50, skip = 0, userId, type } = req.query;
    
    const filter = {};
    if (userId) filter.userId = userId;
    if (type) filter.type = type;

    const activities = await Activity.find(filter)
      .populate("userId", "username email")
      .populate("projectId", "name")
      .populate("taskId", "title")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Activity.countDocuments(filter);

    res.json({ activities, total, page: skip / limit + 1 });
  } catch (error) {
    console.error("Error fetching activities:", error);
    res.status(500).json({ message: "Error fetching activities", error: error.message });
  }
};

// Clear analytics cache
exports.clearAnalyticsCache = async (req, res) => {
  try {
    await redisClient.del("analytics:dashboard");
    await redisClient.del("analytics:project-stats");
    res.json({ message: "Analytics cache cleared" });
  } catch (error) {
    res.status(500).json({ message: "Error clearing cache", error: error.message });
  }
};
