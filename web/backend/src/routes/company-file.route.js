import express from "express";
import {
  downloadCompanyFile,
  getCompanyFiles,
  saveCompanyFiles,
  viewCompanyFile,
} from "../controllers/company-file.controller.js";
import { uploadCompanyFiles } from "../lib/upload.js";
import { checkRole, protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();
router.use(protectRoute, checkRole(["hr"]));
router.get("/", getCompanyFiles);
router.post("/", uploadCompanyFiles, saveCompanyFiles);
router.get("/:fileId/view", viewCompanyFile);
router.get("/:fileId/download", downloadCompanyFile);

export default router;
