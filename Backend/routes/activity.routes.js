const express = require("express");
const {
  getUserActivityFeed,
  getDashboardStats,
  getProjectStats
} = require("../controllers/activity.controller");
const { protect } = require("../middlewares/auth.middleware");
const router = express.Router();


router.use(protect);

/* ============== ACTIVITY ROUTES ============== */


router.get("/feed", getUserActivityFeed);
router.get("/dashboard-stats", getDashboardStats);
router.get("/project-stats", getProjectStats);

module.exports = router;
