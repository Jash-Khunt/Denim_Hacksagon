import express from "express";
import {
  connectToHr,
  getHrDirectory,
  getMyConnections,
  getMyProjectUploads,
  uploadProjectPdf,
} from "../controllers/client.controller.js";
import { upload } from "../lib/upload.js";
import { checkRole, protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protectRoute);
router.use(checkRole(["client"]));

router.get("/hrs", getHrDirectory);
router.get("/connections", getMyConnections);
router.post("/connections/:hrId", express.json(), connectToHr);
router.get("/projects", getMyProjectUploads);
router.post("/projects/upload", upload.single("pdf"), uploadProjectPdf);

export default router;
