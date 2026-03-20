const Task = require("../models/Task.model");
const Project = require("../models/Project.model");
const { getIo } = require("../socket");

/* ============== CREATE TASK ============== */
exports.createTask = async (req, res) => {
  try {
    const { title, description, projectId, assignedTo, priority, dueDate, estimatedHours } = req.body;

    if (!title || !projectId) {
      return res.status(400).json({ message: "Title and project ID are required" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const task = new Task({
      title,
      description,
      project: projectId,
      assignedTo: assignedTo || req.user.id || req.user._id,
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      estimatedHours
    });

    await task.save();
    await task.populate("assignedTo", "username email");

    // Add task to project
    project.tasks.push(task._id);
    await project.save();

    // Emit live event
    try {
      getIo().to(projectId.toString()).emit("task_created", task);
    } catch (err) {
      console.error("Socket emit error:", err);
    }

    res.status(201).json({
      message: "Task created successfully",
      task
    });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({ message: "Failed to create task" });
  }
};

/* ============== GET PROJECT TASKS ============== */
exports.getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;

    const tasks = await Task.find({ project: projectId })
      .populate("assignedTo", "username email")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error("Get tasks error:", error);
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
};

/* ============== GET USER ASSIGNED TASKS ============== */
exports.getUserTasks = async (req, res) => {
  try {
    const userId = req.user.id;

    const tasks = await Task.find({ assignedTo: userId })
      .populate("project", "name")
      .populate("assignedTo", "username email")
      .sort({ dueDate: 1 });

    res.json(tasks);
  } catch (error) {
    console.error("Get user tasks error:", error);
    res.status(500).json({ message: "Failed to fetch user tasks" });
  }
};

/* ============== UPDATE TASK ============== */
exports.updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, status, priority, dueDate, assignedTo, actualHours } = req.body;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (title) task.title = title;
    if (description) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (dueDate) task.dueDate = new Date(dueDate);
    if (assignedTo) task.assignedTo = assignedTo;
    if (actualHours !== undefined) task.actualHours = actualHours;

    await task.save();
    await task.populate("assignedTo", "username email");

    // Emit live event
    try {
      getIo().to(task.project.toString()).emit("task_updated", task);
    } catch (err) {
      console.error("Socket emit error:", err);
    }

    res.json({
      message: "Task updated successfully",
      task
    });
  } catch (error) {
    console.error("Update task error:", error);
    res.status(500).json({ message: "Failed to update task" });
  }
};

/* ============== DELETE TASK ============== */
exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Remove from project
    await Project.findByIdAndUpdate(
      task.project,
      { $pull: { tasks: taskId } }
    );

    await Task.findByIdAndDelete(taskId);

    // Emit live event
    try {
      getIo().to(task.project.toString()).emit("task_deleted", taskId);
    } catch (err) {
      console.error("Socket emit error:", err);
    }

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ message: "Failed to delete task" });
  }
};

/* ============== ADD TASK COMMENT ============== */
exports.addTaskComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    if (!text) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.comments.push({
      userId,
      text
    });

    await task.save();
    await task.populate("comments.userId", "username email");

    const newComment = task.comments[task.comments.length - 1];

    // Emit live event
    try {
      getIo().to(task.project.toString()).emit("new_comment", { taskId, comment: newComment });
    } catch (err) {
      console.error("Socket emit error:", err);
    }

    res.json({
      message: "Comment added successfully",
      task
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ message: "Failed to add comment" });
  }
};
