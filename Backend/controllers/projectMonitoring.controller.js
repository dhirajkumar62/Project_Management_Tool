const Project = require("../models/Project.model");
const Task = require("../models/Task.model");
const User = require("../models/User.model");
const Activity = require("../models/Activity.model");

// Get all projects with monitoring data
exports.getAllProjects = async (req, res) => {
  try {
    const { status, search, sort = "createdAt", limit = 20, page = 1, riskLevel } = req.query;
    
    let filter = {};
    
    if (status && status !== "all") {
      filter.status = status;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let sortObj = {};
    if (sort === "deadline") {
      sortObj = { endDate: 1 };
    } else if (sort === "progress") {
      sortObj = { progress: -1 };
    } else {
      sortObj = { [sort]: -1 };
    }

    let projects = await Project.find(filter)
      .populate("owner", "username email")
      .populate("members.userId", "username email")
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    // Add risk indicator and task info
    projects = await Promise.all(
      projects.map(async (project) => {
        const tasks = await Task.find({ project: project._id });
        const completedTasks = tasks.filter(t => t.status === "completed").length;
        
        const now = new Date();
        const daysUntilDeadline = project.endDate 
          ? Math.ceil((project.endDate - now) / (1000 * 60 * 60 * 24))
          : null;

        // Risk indicator logic
        let riskLevel = "low";
        let riskReason = "";
        
        if (daysUntilDeadline !== null) {
          if (daysUntilDeadline < 3 && project.progress < 50) {
            riskLevel = "critical";
            riskReason = "Deadline < 3 days & progress < 50%";
          } else if (daysUntilDeadline < 7 && project.progress < 70) {
            riskLevel = "high";
            riskReason = "Deadline < 7 days & progress < 70%";
          } else if (daysUntilDeadline < 0) {
            riskLevel = "overdue";
            riskReason = "Project deadline has passed";
          }
        }

        return {
          ...project.toObject(),
          taskStats: {
            total: tasks.length,
            completed: completedTasks,
            pending: tasks.length - completedTasks,
            completionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0
          },
          deadlineInfo: {
            daysRemaining: daysUntilDeadline,
            isOverdue: daysUntilDeadline !== null && daysUntilDeadline < 0
          },
          risk: {
            level: riskLevel,
            reason: riskReason,
            severity: riskLevel === "critical" ? 3 : riskLevel === "high" ? 2 : riskLevel === "overdue" ? 3 : 1
          }
        };
      })
    );

    // Filter by risk level if specified
    if (riskLevel && riskLevel !== "all") {
      projects = projects.filter(p => p.risk.level === riskLevel);
    }

    const total = await Project.countDocuments(filter);

    res.json({
      projects,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Error fetching projects", error: error.message });
  }
};

// Get single project detailed monitoring view
exports.getProjectMonitoring = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId)
      .populate("owner", "username email")
      .populate("members.userId", "username email");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Get all tasks
    const tasks = await Task.find({ project: projectId })
      .populate("assignedTo", "username email");

    // Get activities
    const activities = await Activity.find({ projectId })
      .populate("userId", "username email")
      .sort({ createdAt: -1 })
      .limit(20);

    // Calculate statistics
    const now = new Date();
    const daysUntilDeadline = project.endDate 
      ? Math.ceil((project.endDate - now) / (1000 * 60 * 60 * 24))
      : null;

    const tasksByStatus = {
      todo: tasks.filter(t => t.status === "todo").length,
      in_progress: tasks.filter(t => t.status === "in_progress").length,
      review: tasks.filter(t => t.status === "review").length,
      completed: tasks.filter(t => t.status === "completed").length
    };

    // Risk assessment
    let riskLevel = "low";
    let riskFactors = [];
    
    if (daysUntilDeadline !== null) {
      if (daysUntilDeadline < 3 && project.progress < 50) {
        riskLevel = "critical";
        riskFactors.push("Deadline within 3 days and progress less than 50%");
      } else if (daysUntilDeadline < 7 && project.progress < 70) {
        riskLevel = "high";
        riskFactors.push("Deadline within 7 days and progress less than 70%");
      } else if (daysUntilDeadline < 0) {
        riskLevel = "overdue";
        riskFactors.push("Project deadline has passed");
      }
    }

    if (tasksByStatus.in_progress > tasksByStatus.completed * 2) {
      riskFactors.push("High number of in-progress tasks");
    }

    res.json({
      project,
      tasks,
      tasksByStatus,
      activities,
      monitoring: {
        daysUntilDeadline,
        isOverdue: daysUntilDeadline !== null && daysUntilDeadline < 0,
        taskCompletion: tasks.length > 0 ? Math.round((tasksByStatus.completed / tasks.length) * 100) : 0,
        riskLevel,
        riskFactors
      }
    });
  } catch (error) {
    console.error("Error fetching project monitoring:", error);
    res.status(500).json({ message: "Error fetching project monitoring", error: error.message });
  }
};

// Mark project as delayed
exports.markProjectDelayed = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { reason, newDeadline } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Update project
    if (newDeadline) {
      project.endDate = new Date(newDeadline);
    }

    // Add to admin deadline tracking
    project.adminDeadline = {
      date: new Date(),
      reason: reason || "Project marked as delayed",
      updatedBy: req.user._id,
      updatedAt: new Date()
    };

    project.status = "on_hold";
    await project.save();

    // Log activity
    await Activity.create({
      userId: req.user._id,
      type: "project_delayed",
      title: `Project "${project.name}" marked as delayed`,
      description: reason || "Project status changed to delayed",
      projectId: projectId,
      metadata: { reason, newDeadline }
    });

    res.json({ message: "Project marked as delayed", project });
  } catch (error) {
    console.error("Error marking project delayed:", error);
    res.status(500).json({ message: "Error marking project delayed", error: error.message });
  }
};

// Force archive project
exports.forceArchiveProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { reason } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Update all tasks to completed
    await Task.updateMany(
      { project: projectId },
      { status: "completed" }
    );

    // Mark project as completed
    project.status = "completed";
    project.progress = 100;
    project.endDate = new Date();
    
    await project.save();

    // Log activity
    await Activity.create({
      userId: req.user._id,
      type: "project_archived",
      title: `Project "${project.name}" force archived`,
      description: reason || "Project force archived by admin",
      projectId: projectId,
      metadata: { reason, archivedDate: new Date() }
    });

    res.json({ message: "Project archived successfully", project });
  } catch (error) {
    console.error("Error archiving project:", error);
    res.status(500).json({ message: "Error archiving project", error: error.message });
  }
};

// Get projects at risk
exports.getRiskyProjects = async (req, res) => {
  try {
    const projects = await Project.find({ status: { $ne: "completed" } })
      .populate("owner", "username email");

    let riskyProjects = await Promise.all(
      projects.map(async (project) => {
        const tasks = await Task.find({ project: project._id });
        const now = new Date();
        const daysUntilDeadline = project.endDate 
          ? Math.ceil((project.endDate - now) / (1000 * 60 * 60 * 24))
          : null;

        let riskLevel = "low";
        
        if (daysUntilDeadline !== null && daysUntilDeadline < 3 && project.progress < 50) {
          riskLevel = "critical";
        } else if (daysUntilDeadline !== null && daysUntilDeadline < 7 && project.progress < 70) {
          riskLevel = "high";
        } else if (daysUntilDeadline !== null && daysUntilDeadline < 0) {
          riskLevel = "overdue";
        }

        if (riskLevel !== "low") {
          return {
            _id: project._id,
            name: project.name,
            owner: project.owner,
            progress: project.progress,
            status: project.status,
            endDate: project.endDate,
            daysUntilDeadline,
            riskLevel,
            taskCount: tasks.length,
            completedTasks: tasks.filter(t => t.status === "completed").length
          };
        }
        return null;
      })
    );

    riskyProjects = riskyProjects.filter(p => p !== null);
    riskyProjects.sort((a, b) => {
      const riskOrder = { critical: 0, overdue: 1, high: 2, low: 3 };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });

    res.json({ riskyProjects, count: riskyProjects.length });
  } catch (error) {
    console.error("Error fetching risky projects:", error);
    res.status(500).json({ message: "Error fetching risky projects", error: error.message });
  }
};
