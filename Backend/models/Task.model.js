const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    trim: true
  },

  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true
  },

  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  status: {
    type: String,
    enum: ["todo", "in_progress", "review", "completed"],
    default: "todo"
  },

  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },

  dueDate: Date,

  estimatedHours: Number,
  actualHours: {
    type: Number,
    default: 0
  },

  comments: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      text: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ]

}, { timestamps: true });

module.exports = mongoose.model("Task", taskSchema);
