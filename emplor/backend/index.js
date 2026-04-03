import dotenv from "dotenv";
dotenv.config();

import { testConnection } from "./src/lib/db.js";
import express from "express";
// import path from "path";
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


testConnection();
app.listen(PORT, () => {
  console.log(`>>> Server is running on http://localhost:${PORT}`);
});
