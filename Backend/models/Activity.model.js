const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  type: {
    type: String,
    enum: [
      "project_created",
      "project_updated",
      "project_completed",
      "project_deleted",
      "project_delayed",
      "project_archived",
      "project_deadline_updated",
      "project_progress_updated",
      "task_created",
      "task_completed",
      "task_assigned",
      "task_deleted",
      "deadline_approaching",
      "member_added",
      "user_role_changed",
      "user_deactivated",
      "user_activated",
      "user_deleted"
    ],
    required: true
  },

  title: {
    type: String,
    required: true
  },

  description: String,

  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project"
  },

  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task"
  },

  metadata: {
    type: mongoose.Schema.Types.Mixed
  }

}, { timestamps: true });

module.exports = mongoose.model("Activity", activitySchema);
