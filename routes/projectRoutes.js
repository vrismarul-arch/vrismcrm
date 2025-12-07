const router = require("express").Router();
const {
  createProject,
  getProjects,
  updateProject,
  deleteProject,
  getProjectStats,
  getProjectById,addProjectNote,deleteProjectNote
} = require("../controllers/projectController");

// Project Stats
router.get("/stats", getProjectStats);

// CRUD
router.get("/", getProjects);
router.get("/:id", getProjectById);
router.post("/", createProject);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);
router.put("/:id/note", addProjectNote);
router.put("/:id/note/delete", deleteProjectNote);

module.exports = router;