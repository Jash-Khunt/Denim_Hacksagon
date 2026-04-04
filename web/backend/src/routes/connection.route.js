import express from "express";
import {
  getHrConnections,
  respondToConnection,
} from "../controllers/connection.controller.js";
import { checkRole, protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protectRoute);
router.use(checkRole(["hr"]));

router.get("/hr", getHrConnections);
router.patch("/:connectionId", express.json(), respondToConnection);

export default router;
