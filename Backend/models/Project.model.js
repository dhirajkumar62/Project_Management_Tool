const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    trim: true
  },

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  members: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      role: {
        type: String,
        enum: ["lead", "member"],
        default: "member"
      }
    }
  ],

  status: {
    type: String,
    enum: ["planning", "in_progress", "on_hold", "completed"],
    default: "planning"
  },

  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },

  startDate: Date,
  
  endDate: Date,
  
  
  adminDeadline: {
    date: Date,
    reason: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    updatedAt: Date
  },

 
  progressHistory: [
    {
      percentage: Number,
      status: String,
      reason: String,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],

  tasks: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task"
    }
  ],

  budget: {
    allocated: Number,
    spent: {
      type: Number,
      default: 0
    }
  }

}, { timestamps: true });

module.exports = mongoose.model("Project", projectSchema);
