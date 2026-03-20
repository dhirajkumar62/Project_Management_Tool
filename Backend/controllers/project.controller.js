const Project = require("../models/Project.model");
const Task = require("../models/Task.model");
const User = require("../models/User.model");

/* ============== CREATE PROJECT ============== */
exports.createProject = async (req, res) => {
  try {
    const { name, description, members, leader, priority, startDate, endDate, budget } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ message: "Project name is required" });
    }

    // Create members array with roles
    let membersArray = [];
    if (members && members.length > 0) {
      membersArray = members.map(id => ({
        userId: id,
        role: leader && id === leader ? "lead" : "member"
      }));
    }

    const project = new Project({
      name,
      description,
      owner: userId,
      priority,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      budget: budget ? { allocated: budget } : undefined,
      members: membersArray
    });

    await project.save();
    
    // Populate both owner and members
    await project.populate("owner", "username email");
    await project.populate("members.userId", "username email");

    res.status(201).json({
      message: "Project created successfully",
      project
    });
  } catch (error) {
    console.error("Create project error:", error);
    res.status(500).json({ message: "Failed to create project" });
  }
};

/* ============== GET USER'S PROJECTS ============== */
exports.getUserProjects = async (req, res) => {
  try {
    const userId = req.user.id;

    const projects = await Project.find({
      $or: [
        { owner: userId },
        { "members.userId": userId }
      ]
    })
      .populate("owner", "username email")
      .populate("members.userId", "username email")
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error("Get projects error:", error);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
};

/* ============== GET ALL PROJECTS (ADMIN) ============== */
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate("owner", "username email")
      .populate("members.userId", "username email")
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error("Get all projects error:", error);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
};

/* ============== GET PROJECT DETAILS ============== */
exports.getProjectDetails = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate("owner", "username email")
      .populate("members.userId", "username email")
      .populate({
        path: "tasks",
        select: "title status priority dueDate assignedTo"
      });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json(project);
  } catch (error) {
    console.error("Get project details error:", error);
    res.status(500).json({ message: "Failed to fetch project details" });
  }
};

/* ============== UPDATE PROJECT ============== */
exports.updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, status, progress, priority, endDate, members } = req.body;
    const userId = req.user.id;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check authorization
    if (project.owner.toString() !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to update this project" });
    }

    if (name) project.name = name;
    if (description) project.description = description;
    if (status) project.status = status;
    if (progress !== undefined) project.progress = progress;
    if (priority) project.priority = priority;
    if (endDate) project.endDate = new Date(endDate);
    if (members) project.members = members.map(id => ({ userId: id, role: "member" }));

    await project.save();
    await project.populate("owner members.userId");

    res.json({
      message: "Project updated successfully",
      project
    });
  } catch (error) {
    console.error("Update project error:", error);
    res.status(500).json({ message: "Failed to update project" });
  }
};

/* ============== DELETE PROJECT ============== */
exports.deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Only admin or project owner can delete
    if (project.owner.toString() !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this project" });
    }

    await Project.findByIdAndDelete(projectId);
    await Task.deleteMany({ project: projectId });

    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({ message: "Failed to delete project" });
  }
};

/* ============== GET PROJECT STATISTICS ============== */
exports.getProjectStats = async (req, res) => {
  try {
    const totalProjects = await Project.countDocuments();
    const activeProjects = await Project.countDocuments({ status: { $ne: "completed" } });
    const completedProjects = await Project.countDocuments({ status: "completed" });

    const projectsByStatus = await Project.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: "completed" });

    res.json({
      totalProjects,
      activeProjects,
      completedProjects,
      projectsByStatus,
      totalTasks,
      completedTasks,
      taskCompletionRate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0
    });
  } catch (error) {
    console.error("Get project stats error:", error);
    res.status(500).json({ message: "Failed to fetch statistics" });
  }
};

/* ============== ADD PROJECT MEMBER ============== */
exports.addProjectMember = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { memberId, userId } = req.body;
    const currentUserId = req.user.id;
    
    // Accept either memberId or userId from frontend
    const memberIdToAdd = memberId || userId;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (project.owner.toString() !== currentUserId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Check if member already exists
    const memberExists = project.members.some(m => m.userId.toString() === memberIdToAdd);

    if (memberExists) {
      return res.status(400).json({ message: "Member already in project" });
    }

    project.members.push({ userId: memberIdToAdd, role: "member" });
    await project.save();
    await project.populate("members.userId");

    res.json({
      message: "Member added successfully",
      project
    });
  } catch (error) {
    console.error("Add member error:", error);
    res.status(500).json({ message: "Failed to add member" });
  }
};

/* ============== REMOVE PROJECT MEMBER ============== */
exports.removeProjectMember = async (req, res) => {
  try {
    const { projectId, memberId } = req.params;
    const userId = req.user.id;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (project.owner.toString() !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    project.members = project.members.filter(m => m.userId.toString() !== memberId);
    await project.save();
    await project.populate("members.userId");

    res.json({
      message: "Member removed successfully",
      project
    });
  } catch (error) {
    console.error("Remove member error:", error);
    res.status(500).json({ message: "Failed to remove member" });
  }
};

/* ============== ADMIN: UPDATE PROJECT DEADLINE ============== */
exports.updateProjectDeadline = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { date, reason } = req.body;
    const adminId = req.user.id;

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update deadlines" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    project.adminDeadline = {
      date: new Date(date),
      reason: reason || "",
      updatedBy: adminId,
      updatedAt: new Date()
    };

    project.endDate = new Date(date);

    await project.save();
    await project.populate("owner members.userId");
    await project.populate("adminDeadline.updatedBy", "username");

    const Activity = require("../models/Activity.model");
    await Activity.create({
      userId: adminId,
      type: "project_deadline_updated",
      title: `Deadline updated: ${project.name}`,
      description: `Deadline updated to ${new Date(date).toLocaleDateString()}`,
      projectId: projectId
    });

    res.json({
      message: "Project deadline updated successfully",
      project
    });
  } catch (error) {
    console.error("Update deadline error:", error);
    res.status(500).json({ message: "Failed to update deadline" });
  }
};

/* ============== ADMIN: UPDATE PROJECT PROGRESS & STATUS ============== */
exports.updateProjectProgress = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { progress, status, reason } = req.body;
    const adminId = req.user.id;

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update progress" });
    }

    if (progress !== undefined && (progress < 0 || progress > 100)) {
      return res.status(400).json({ message: "Progress must be between 0 and 100" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (progress !== undefined) {
      project.progress = progress;

      project.progressHistory.push({
        percentage: progress,
        status: status || project.status,
        reason: reason || "",
        updatedBy: adminId,
        updatedAt: new Date()
      });
    }

    if (status) {
      project.status = status;
      
      if (status === "completed" && project.progress < 100) {
        project.progress = 100;
      }
    }

    await project.save();
    await project.populate("owner members.userId");
    await project.populate("progressHistory.updatedBy", "username");

    const Activity = require("../models/Activity.model");
    const changes = [];
    if (progress !== undefined) changes.push(`progress to ${progress}%`);
    if (status) changes.push(`status to ${status}`);
    
    await Activity.create({
      userId: adminId,
      type: "project_progress_updated",
      title: `Progress updated: ${project.name}`,
      description: `Updated ${changes.join(" and ")}`,
      projectId: projectId
    });

    res.json({
      message: "Project progress updated successfully",
      project
    });
  } catch (error) {
    console.error("Update progress error:", error);
    res.status(500).json({ message: "Failed to update progress" });
  }
};

/* ============== ADMIN: GET PROJECT WITH DEADLINE & PROGRESS DETAILS ============== */
exports.getProjectAdminView = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can view this" });
    }

    const project = await Project.findById(projectId)
      .populate("owner", "username email")
      .populate("members.userId", "username email")
      .populate("adminDeadline.updatedBy", "username")
      .populate("progressHistory.updatedBy", "username")
      .populate({
        path: "tasks",
        select: "title status priority dueDate assignedTo actualHours"
      });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const completedTasks = project.tasks.filter(t => t.status === "completed").length;
    const totalTasks = project.tasks.length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({
      project,
      metrics: {
        totalTasks,
        completedTasks,
        taskCompletionRate,
        deadline: project.adminDeadline?.date || project.endDate,
        daysRemaining: project.endDate ? Math.ceil((new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : null
      }
    });
  } catch (error) {
    console.error("Get project admin view error:", error);
    res.status(500).json({ message: "Failed to fetch project details" });
  }
};

/* ============== ADMIN: GET ALL PROJECTS WITH DEADLINE & PROGRESS INFO ============== */
exports.getAllProjectsAdminView = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can view this" });
    }

    const projects = await Project.find()
      .populate("owner", "username email")
      .populate("members.userId", "username email")
      .populate({
        path: "tasks",
        select: "status"
      })
      .sort({ createdAt: -1 });

    const projectsWithMetrics = projects.map(project => {
      const completedTasks = project.tasks.filter(t => t.status === "completed").length;
      const totalTasks = project.tasks.length;
      const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      const deadline = project.adminDeadline?.date || project.endDate;
      const daysRemaining = deadline ? Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24)) : null;
      
      return {
        ...project.toObject(),
        metrics: {
          totalTasks,
          completedTasks,
          taskCompletionRate,
          daysRemaining,
          isOverdue: daysRemaining !== null && daysRemaining < 0 && project.status !== "completed"
        }
      };
    });

    res.json(projectsWithMetrics);
  } catch (error) {
    console.error("Get all projects admin view error:", error);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
};
