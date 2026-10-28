import express from "express";
import { checkRole, protectRoute } from "../middlewares/auth.middleware.js";
import { createMeeting, getMeetingJoinToken, getMeetings, getMessages, getMyMeetings, getPartners, sendMessage, updateMeeting } from "../controllers/communication.controller.js";

const router = express.Router();
router.use(protectRoute, checkRole(["hr", "client"]));
router.get("/partners", getPartners);
router.get("/meetings", getMyMeetings);
router.get("/:clientId/:hrId/messages", getMessages);
router.post("/:clientId/:hrId/messages", sendMessage);
router.get("/:clientId/:hrId/meetings", getMeetings);
router.post("/:clientId/:hrId/meetings", createMeeting);
router.patch("/meetings/:meetingId", updateMeeting);
router.get("/meetings/:meetingId/join-token", getMeetingJoinToken);
export default router;
