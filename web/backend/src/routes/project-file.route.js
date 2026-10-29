import express from "express";
import { getProjectFile } from "../controllers/client.controller.js";
import { checkRole, protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();
router.get(
  "/:uploadId",
  protectRoute,
  checkRole(["hr", "employee", "client"]),
  getProjectFile,
);

export default router;
