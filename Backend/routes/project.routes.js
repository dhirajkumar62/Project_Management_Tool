const express = require("express");
const {
  createProject,
  getUserProjects,
  getAllProjects,
  getProjectDetails,
  updateProject,
  deleteProject,
  getProjectStats,
  addProjectMember,
  removeProjectMember,
  updateProjectDeadline,
  updateProjectProgress,
  getProjectAdminView,
  getAllProjectsAdminView
} = require("../controllers/project.controller");
const { protect, adminOnly } = require("../middlewares/auth.middleware");

const router = express.Router();
router.use(protect);

/* ============== PROJECT ROUTES ============== */
router.get("/stats", adminOnly, getProjectStats);
router.get("/admin/all-projects/view", adminOnly, getAllProjectsAdminView);
router.post("/", createProject);
router.get("/my-projects", getUserProjects);
router.get("/all", adminOnly, getAllProjects);


router.get("/:projectId/admin/view", adminOnly, getProjectAdminView);
router.put("/:projectId/admin/deadline", adminOnly, updateProjectDeadline);
router.put("/:projectId/admin/progress", adminOnly, updateProjectProgress);
router.post("/:projectId/members", addProjectMember);
router.delete("/:projectId/members/:memberId", removeProjectMember);

router.get("/:projectId", getProjectDetails);
router.put("/:projectId", updateProject);
router.delete("/:projectId", deleteProject);

module.exports = router;
