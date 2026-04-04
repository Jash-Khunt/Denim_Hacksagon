import express from "express";
import {
  getJiraTicketSummary,
  getJiraTickets,
} from "../controllers/jira.controller.js";
import { protectRoute, checkRole } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protectRoute);
router.use(checkRole(["hr", "employee", "client"]));

router.get("/tickets", getJiraTickets);
router.get("/summary", getJiraTicketSummary);

export default router;
