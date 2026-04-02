const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const { getReports, getReportAgents } = require("../controllers/reportsController");

// Reports data
router.get("/", authMiddleware, roleMiddleware(["admin", "manager", "sales_rep"]), getReports);

// Agents for reports filter dropdown
router.get("/agents", authMiddleware, roleMiddleware(["admin", "manager", "sales_rep"]), getReportAgents);

module.exports = router;
