import express from "express";
import {
  createChatbotJiraTickets,
  createJiraTicketsForHr,
  getHrProjectUploads,
  getJiraTicketSummary,
  getJiraTickets,
} from "../controllers/jira.controller.js";
import { protectRoute, checkRole } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/chatbot-create", express.json({ limit: "2mb" }), createChatbotJiraTickets);

router.use(protectRoute);
router.use(checkRole(["hr", "employee", "client"]));

router.get("/uploads", checkRole(["hr"]), getHrProjectUploads);
router.post("/create", express.json({ limit: "2mb" }), checkRole(["hr"]), createJiraTicketsForHr);
router.get("/tickets", getJiraTickets);
router.get("/summary", getJiraTicketSummary);

export default router;
