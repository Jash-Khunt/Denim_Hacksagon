import express from "express";
import {
  askAssistant,
  getAssistantStatistics,
} from "../controllers/assistant.controller.js";
import { protectRoute, checkRole } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protectRoute);
router.use(checkRole(["hr", "employee", "client"]));

router.post("/ask", askAssistant);
router.get("/statistics", getAssistantStatistics);

export default router;
