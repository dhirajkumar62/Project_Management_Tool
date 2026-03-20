const Activity = require("../models/Activity.model");
const Task = require("../models/Task.model");
const Project = require("../models/Project.model");

/* ============== LOG ACTIVITY ============== */
exports.logActivity = async (userId, type, title, description, projectId = null, taskId = null, metadata = null) => {
  try {
    await Activity.create({
      userId,
      type,
      title,
      description,
      projectId,
      taskId,
      metadata
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};

/* ============== GET USER ACTIVITY FEED ============== */
exports.getUserActivityFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 10;

    const activities = await Activity.find({ userId })
      .populate("projectId", "name")
      .populate("taskId", "title")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(activities);
  } catch (error) {
    console.error("Get activity feed error:", error);
    res.status(500).json({ message: "Failed to fetch activity feed" });
  }
};

/* ============== GET DASHBOARD STATS ============== */
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get projects
    const projects = await Project.find({
      $or: [
        { owner: userId },
        { "members.userId": userId }
      ]
    });

    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status === "in_progress").length;
    const completedProjects = projects.filter(p => p.status === "completed").length;

    // Get tasks
    const tasks = await Task.find({ assignedTo: userId });
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === "completed").length;
    const overdueTasks = tasks.filter(t => {
      if (t.status === "completed") return false;
      const dueDate = t.dueDate ? new Date(t.dueDate) : null;
      return dueDate && dueDate < new Date();
    }).length;

    // Get this week's completed tasks
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeekCompleted = tasks.filter(t => {
      const completedTime = t.updatedAt;
      return t.status === "completed" && completedTime > oneWeekAgo;
    }).length;

    // Get tasks due today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dueToday = tasks.filter(t => {
      if (t.status === "completed") return false;
      const dueDate = t.dueDate ? new Date(t.dueDate) : null;
      if (!dueDate) return false;
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === today.getTime();
    }).length;

    res.json({
      projects: {
        total: totalProjects,
        active: activeProjects,
        completed: completedProjects
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        dueToday,
        thisWeekCompleted
      }
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
};

/* ============== GET PROJECT STATS FOR CHART ============== */
exports.getProjectStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all projects for user
    const projects = await Project.find({
      $or: [
        { owner: userId },
        { "members.userId": userId }
      ]
    }).populate("tasks");

    // Prepare chart data
    const chartData = projects.map(project => ({
      name: project.name,
      progress: project.progress || 0,
      status: project.status
    }));

    res.json(chartData);
  } catch (error) {
    console.error("Get project stats error:", error);
    res.status(500).json({ message: "Failed to fetch project stats" });
  }
};
