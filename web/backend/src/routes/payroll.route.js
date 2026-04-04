import express from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import {
  getMyPayroll,
  getAllPayroll,
  getPayrollSummary,
  updateSalary,
  processPayroll,
  payIndividual,
} from "../controllers/payroll.controller.js";

const router = express.Router();

router.use(protectRoute);

// Employee
router.get("/my-payroll", getMyPayroll);

// Admin
router.get("/all", getAllPayroll);
router.get("/summary", getPayrollSummary);
router.put("/update-salary/:id", updateSalary);
router.post("/process", processPayroll);
router.post("/pay-individual", payIndividual);

export default router;
