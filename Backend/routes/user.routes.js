const express = require("express");
const {
  getAllUsers,
  getUserStats,
  updateUserRole,
  deleteUser,
  toggleUserStatus,
  getUserDetails
} = require("../controllers/user.controller");
const { protect, adminOnly } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/available/list", protect, getAllUsers);
router.use(protect, adminOnly);

/* ============== USER MANAGEMENT ROUTES ============== */

router.get("/stats", getUserStats);
router.get("/", getAllUsers);
router.get("/:userId/details", getUserDetails);
router.put("/:userId/role", updateUserRole);
router.put("/:userId/status", toggleUserStatus);
router.delete("/:userId", deleteUser);

module.exports = router;
