const Activity = require("../models/Activity.model");

// Activity logging middleware
const logActivity = async (req, res, next) => {
  // Store original send function
  const originalSend = res.send;

  // Override send to capture response
  res.send = function (data) {
    res.send = originalSend;
    
    // Only log successful requests (status < 400)
    if (req.user && res.statusCode < 400) {
      logActivityAsync(req, res);
    }
    
    return res.send(data);
  };

  next();
};

async function logActivityAsync(req, res) {
  try {
    const { method, path, user } = req;
    
    let activityType = null;
    let title = null;
    let description = null;
    let relatedId = null;

    // Define activity types based on routes and methods
    if (path.includes("/projects") && method === "POST") {
      activityType = "project_created";
      title = `Project created`;
      description = `User created a new project`;
    } else if (path.includes("/projects") && method === "PUT") {
      activityType = "project_updated";
      title = `Project updated`;
      description = `User updated project details`;
      const projectId = path.split("/")[3];
      relatedId = projectId;
    } else if (path.includes("/projects") && path.includes("complete") && method === "PUT") {
      activityType = "project_completed";
      title = `Project completed`;
      description = `User marked project as completed`;
      const projectId = path.split("/")[3];
      relatedId = projectId;
    } else if (path.includes("/tasks") && method === "POST") {
      activityType = "task_created";
      title = `Task created`;
      description = `User created a new task`;
    } else if (path.includes("/tasks") && path.includes("complete") && method === "PUT") {
      activityType = "task_completed";
      title = `Task completed`;
      description = `User completed a task`;
    } else if (path.includes("/tasks") && method === "PUT") {
      activityType = "task_assigned";
      title = `Task assigned`;
      description = `User assigned a task`;
    } else if (path.includes("/tasks") && method === "DELETE") {
      activityType = "task_deleted";
      title = `Task deleted`;
      description = `User deleted a task`;
    }

    if (activityType) {
      await Activity.create({
        userId: user._id,
        type: activityType,
        title: title,
        description: description,
        metadata: { 
          method, 
          path,
          userAgent: req.headers["user-agent"]
        }
      });
    }
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't break the request if logging fails
  }
}

module.exports = { logActivity };
