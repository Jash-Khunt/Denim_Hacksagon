import express from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import {
  createLeaveRequest,
  getMyLeaves,
  getAllLeaves,
  approveLeave,
  rejectLeave,
} from "../controllers/leave.controller.js";

const router = express.Router();

router.use(protectRoute);

// Employee routes
router.post("/request", createLeaveRequest); // Submit leave request
router.get("/my-leaves", getMyLeaves); // Get own leave history

// Admin/HR routes
router.get("/all", getAllLeaves); // Get all leave requests
router.put("/approve/:id", approveLeave); // Approve leave
router.put("/reject/:id", rejectLeave); // Reject leave

export default router;
