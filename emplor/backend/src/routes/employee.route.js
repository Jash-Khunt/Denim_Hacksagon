import express from "express";
import { addEmployee, getAllEmployees } from "../controllers/employee.controller.js";
import { protectRoute, checkRole } from "../middlewares/auth.middleware.js";
import { upload } from "../lib/upload.js";

const router = express.Router();

router.use(protectRoute);

// HR adds employee with optional profile picture
router.post("/add", checkRole(["hr"]), upload.single("profile_picture"), addEmployee);
router.get("/all", checkRole(["hr"]), getAllEmployees);

export default router;