const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },

  avatar: {
    type: String,
    default: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
  },

  password: String,

  googleId: String,
  githubId: String,

  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  status: {
    type: String,
    enum: ["active", "blocked"],
    default: "active"
  }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
