import express from "express";
import {
  registerHr,
  registerClient,
  login,
  logout,
  getMe,
} from "../controllers/auth.controller.js";
import { upload } from "../lib/upload.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

// HR Signup: Accepts 'logo' AND 'profile_picture' fields
router.post(
  "/signup",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "profile_picture", maxCount: 1 },
  ]),
  registerHr
);

router.post(
  "/signup/client",
  upload.single("profile_picture"),
  registerClient
);

router.post("/login", login);
router.post("/logout", logout);

// Return current authenticated user (uses cookie-based jwt)
router.get("/me", protectRoute, getMe);

export default router;
