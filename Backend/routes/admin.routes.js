const express = require("express");
const { protect } = require("../middlewares/auth.middleware");
const adminController = require("../controllers/admin.controller");

const router = express.Router();

// Middleware to check if user is admin
const adminCheck = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Access denied. Admin only." });
  }
};

// All admin routes require authentication and admin role
router.use(protect);
router.use(adminCheck);

// User management
router.get("/users", adminController.getAllUsers);
router.get("/users/:userId", adminController.getUserDetails);
router.put("/users/:userId/role", adminController.changeUserRole);
router.put("/users/:userId/deactivate", adminController.deactivateUser);
router.put("/users/:userId/activate", adminController.activateUser);
router.delete("/users/:userId", adminController.deleteUser);

// User statistics
router.get("/stats/users", adminController.getUserStats);

module.exports = router;
