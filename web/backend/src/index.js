import dotenv from "dotenv";
dotenv.config();

import { testConnection } from "./lib/db.js";
import { ensureWorkflowSchema } from "./lib/schema.js";
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.route.js";
import employeeRoutes from "./routes/employee.route.js";
import profileRoutes from "./routes/profile.route.js";
import attendanceRoutes from "./routes/attendance.route.js";
import leaveRoutes from "./routes/leave.route.js";
import payrollRoutes from "./routes/payroll.route.js";
import clientRoutes from "./routes/client.route.js";
import jiraRoutes from "./routes/jira.route.js";
import connectionRoutes from "./routes/connection.route.js";
import taskRoutes from "./routes/task.route.js";
import assistantRoutes from "./routes/assistant.route.js";
import { initializeTaskScheduler } from "./lib/task-scheduler.js";
import cors from "cors";
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:8081",
      "http://localhost:5173",
      "http://localhost:8080",
      "http://localhost:3000",
    ],
    credentials: true,
  }),
);

const PORT = process.env.PORT || 3001;
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const assistantDocumentsDir = path.resolve(
  currentDir,
  "../../../rag_model/pathway/client",
);
const assistantDataDir = path.resolve(
  currentDir,
  "../../../rag_model/pathway/data",
);

app.use("/api/v1/auth/users", authRoutes);
app.use("/api/v1/hr", employeeRoutes);
app.use("/api/v1/client", clientRoutes);
app.use("/api/v1/connections", connectionRoutes);
app.use("/api/v1/up", profileRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/leave", leaveRoutes);
app.use("/api/v1/payroll", payrollRoutes);
app.use("/api/v1/jira", jiraRoutes);
app.use("/api/v1/tasks", taskRoutes);
app.use("/api/v1/assistant", assistantRoutes);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/assistant-documents", express.static(assistantDocumentsDir));
app.use("/assistant-data", express.static(assistantDataDir));

const startServer = async () => {
  await testConnection();
  await ensureWorkflowSchema();
  initializeTaskScheduler();

  app.listen(PORT, () => {
    console.log(`>>> Server is running on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
