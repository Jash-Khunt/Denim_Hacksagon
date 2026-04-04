import express from "express";
import {
  addTaskComment,
  getTaskById,
  getTasks,
  importTasksFromBot,
  updateTask,
} from "../controllers/task.controller.js";
import { checkRole, protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protectRoute);

router.get("/", checkRole(["hr", "employee", "client"]), getTasks);
router.get("/:taskId", checkRole(["hr", "employee", "client"]), getTaskById);
router.patch("/:taskId", express.json(), checkRole(["hr", "employee"]), updateTask);
router.post(
  "/:taskId/comments",
  express.json(),
  checkRole(["hr", "employee", "client"]),
  addTaskComment,
);
router.post(
  "/import",
  express.json({ limit: "2mb" }),
  checkRole(["hr", "client"]),
  importTasksFromBot,
);

export default router;
