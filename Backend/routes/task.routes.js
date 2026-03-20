const express = require("express");
const {
  createTask,
  getProjectTasks,
  getUserTasks,
  updateTask,
  deleteTask,
  addTaskComment
} = require("../controllers/task.controller");
const { protect } = require("../middlewares/auth.middleware");

const router = express.Router();
router.use(protect);

/* ============== TASK ROUTES ============== */


router.post("/", createTask);
router.get("/my-tasks", getUserTasks);


router.get("/project/:projectId", getProjectTasks);
router.put("/:taskId", updateTask);
router.delete("/:taskId", deleteTask);
router.post("/:taskId/comments", addTaskComment);

module.exports = router;
