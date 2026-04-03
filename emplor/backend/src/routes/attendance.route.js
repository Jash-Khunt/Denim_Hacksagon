import express from "express";
import {
  markAttendance,
  checkOutAttendance,
  getAttendanceStats,
  getWeeklyAttendance,
  getDailyAttendance,
  getTodayStatus,
  getHREmployeesAttendance,
  getHREmployeeWeekly,
  getHREmployeeDaily,
} from "../controllers/attendance.controller.js";
import { protectRoute, checkRole } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protectRoute);

// Employee checks in
router.post("/check-in", checkRole(["employee"]), markAttendance);

// Employee checks out
router.post("/check-out", checkRole(["employee"]), checkOutAttendance);

// Get attendance stats (present, absent, leave, total hours)
router.get("/stats", getAttendanceStats);

// Weekly attendance (for the frontend weekly view)
router.get("/weekly", getWeeklyAttendance);

// Daily attendance log (for frontend table view)
router.get("/daily", getDailyAttendance);

// Today's check-in/out status
router.get("/today", checkRole(["employee"]), getTodayStatus);

// HR: Get all employees with today's attendance status
router.get("/hr/employees", checkRole(["hr"]), getHREmployeesAttendance);

// HR: Get weekly attendance for a specific employee
router.get("/hr/employee/:empId/weekly", checkRole(["hr"]), getHREmployeeWeekly);

// HR: Get daily attendance for a specific employee
router.get("/hr/employee/:empId/daily", checkRole(["hr"]), getHREmployeeDaily);

export default router;
