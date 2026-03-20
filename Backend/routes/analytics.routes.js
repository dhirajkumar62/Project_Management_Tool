const express = require("express");
const { protect } = require("../middlewares/auth.middleware");
const analyticsController = require("../controllers/analytics.controller");

const router = express.Router();

// Middleware to check if user is admin
const adminCheck = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Access denied. Admin only." });
  }
};

// All analytics routes require authentication and admin role
router.use(protect);
router.use(adminCheck);

// Dashboard analytics
router.get("/dashboard", analyticsController.getDashboardAnalytics);

// Project statistics
router.get("/projects", analyticsController.getProjectStats);

// Recent activities
router.get("/activities", analyticsController.getRecentActivities);

// Clear cache (admin only)
router.post("/clear-cache", analyticsController.clearAnalyticsCache);

module.exports = router;
