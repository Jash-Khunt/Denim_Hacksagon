import dotenv from "dotenv";
dotenv.config();

import { testConnection } from "./src/lib/db.js";
import express from "express";
import path from "path";
import employeeRoutes from "./src/routes/employee.route.js";
import profileRoutes from "./src/routes/profile.route.js";
import attendanceRoutes from "./src/routes/attendance.route.js";
import leaveRoutes from "./src/routes/leave.route.js";
import payrollRoutes from "./src/routes/payroll.route.js";
import cookieParser from "cookie-parser";

import authRoutes from "./src/routes/auth.route.js";
import cors from "cors";
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:8080", "http://localhost:5173"],
    credentials: true,
  })
);

const PORT = process.env.PORT || 3000;

app.use("/api/v1/auth/users", authRoutes);

app.use("/api/v1/hr", employeeRoutes);
app.use("/api/v1/up", profileRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/leave", leaveRoutes);
app.use("/api/v1/payroll", payrollRoutes);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));


testConnection();
app.listen(PORT, () => {
  console.log(`>>> Server is running on http://localhost:${PORT}`);
});
