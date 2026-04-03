import express from "express";
import {
  getProfile,
  updateProfile,
  updateImage,
} from "../controllers/profile.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";
import { upload } from "../lib/upload.js";

const router = express.Router();

router.use(protectRoute);

router.get("/:id", getProfile);
router.put("/update", updateProfile);

// Generic image upload route.
// Frontend MUST set field name to 'logo' (for HR logo) or 'profile_picture' (for User DP)
router.post("/upload-image", upload.single("profile_picture"), updateImage);

export default router;
