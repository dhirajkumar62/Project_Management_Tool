const express = require("express");
const { protect } = require("../middlewares/auth.middleware");
const projectMonitoringController = require("../controllers/projectMonitoring.controller");

const router = express.Router();

// Middleware to check if user is admin
const adminCheck = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Access denied. Admin only." });
  }
};

// All project monitoring routes require authentication and admin role
router.use(protect);
router.use(adminCheck);

// Project monitoring
router.get("/", projectMonitoringController.getAllProjects);
router.get("/risky", projectMonitoringController.getRiskyProjects);
router.get("/:projectId", projectMonitoringController.getProjectMonitoring);
router.put("/:projectId/delay", projectMonitoringController.markProjectDelayed);
router.put("/:projectId/archive", projectMonitoringController.forceArchiveProject);

module.exports = router;
