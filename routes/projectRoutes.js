const router = require("express").Router();
const {
  createProject,
  updateProject,
  getProjects,
  getProjectById,
  deleteProject,
  getProjectStats,
} = require("../controllers/projectController");

// Order matters 🔥
router.get("/stats", getProjectStats);
router.get("/", getProjects);
router.get("/:id", getProjectById);

router.post("/", createProject);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);

module.exports = router;
