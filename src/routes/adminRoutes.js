const express = require("express");
const {
  login,
  logout,
  checkSession,
  createAdmin,
  getLogs,
  bulkUpdateCSV
} = require("../controllers/adminController");
const { authenticateAdmin } = require("../middlewares/auth");

const router = express.Router();

router.post("/admin/login", login);
router.post("/admin/logout", logout);
router.get("/admin/session", checkSession);
router.post("/admin/create", authenticateAdmin, createAdmin);
router.get("/admin/logs", authenticateAdmin, getLogs);
router.post("/admin/bulk-update", authenticateAdmin, bulkUpdateCSV);

module.exports = router;
