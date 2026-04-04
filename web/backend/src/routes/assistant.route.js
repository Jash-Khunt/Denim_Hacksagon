import express from "express";
import {
  askAssistant,
  clearAssistantThreads,
  createAssistantThread,
  deleteAssistantThread,
  getAssistantDashboardSummary,
  getAssistantStatistics,
  getAssistantThreads,
} from "../controllers/assistant.controller.js";
import { protectRoute, checkRole } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protectRoute);
router.use(checkRole(["hr", "employee", "client"]));

router.get("/threads", getAssistantThreads);
router.post("/threads", createAssistantThread);
router.delete("/threads", clearAssistantThreads);
router.delete("/threads/:threadId", deleteAssistantThread);
router.post("/ask", askAssistant);
router.post("/dashboard-summary", getAssistantDashboardSummary);
router.get("/statistics", getAssistantStatistics);

export default router;
