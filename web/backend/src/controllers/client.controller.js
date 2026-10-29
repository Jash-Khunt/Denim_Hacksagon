import { pool } from "../lib/db.js";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const allowedModes = new Set(["connect", "chat", "meeting"]);

export const getHrDirectory = async (req, res) => {
  try {
    const clientId = req.user.client_id;

    const result = await pool.query(
      `SELECT
        h.hr_id,
        h.name,
        h.email,
        h.phone,
        h.company_name,
        h.logo,
        h.profile_picture,
        h.created_at,
        p.department,
        p.location,
        p.summary,
        p.skills,
        COALESCE(team.employee_count, 0) AS employee_count,
        conn.connection_id,
        conn.status AS connection_status,
        conn.last_requested_mode,
        conn.message AS connection_message,
        conn.updated_at AS connection_updated_at
      FROM hr h
      LEFT JOIN profile_info p
        ON h.hr_id = p.hr_id
        AND p.emp_id IS NULL
      LEFT JOIN (
        SELECT hr_id, COUNT(*)::INT AS employee_count
        FROM employee
        GROUP BY hr_id
      ) team
        ON h.hr_id = team.hr_id
      LEFT JOIN client_hr_connections conn
        ON conn.hr_id = h.hr_id
        AND conn.client_id = $1
      ORDER BY h.created_at DESC`,
      [clientId]
    );

    res.status(200).json({ hrs: result.rows });
  } catch (error) {
    console.error("Error in getHrDirectory:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const connectToHr = async (req, res) => {
  const { hrId } = req.params;
  const { mode = "connect", message = "" } = req.body;
  const clientId = req.user.client_id;

  if (!allowedModes.has(mode)) {
    return res.status(400).json({ message: "Invalid connection mode" });
  }

  try {
    const hrResult = await pool.query(
      "SELECT hr_id, name, company_name FROM hr WHERE hr_id = $1",
      [hrId]
    );

    if (hrResult.rows.length === 0) {
      return res.status(404).json({ message: "HR not found" });
    }

    const connectionResult = await pool.query(
      `INSERT INTO client_hr_connections (
        client_id,
        hr_id,
        status,
        last_requested_mode,
        message
      )
      VALUES ($1, $2, 'pending', $3, $4)
      ON CONFLICT (client_id, hr_id)
      DO UPDATE SET
        status = CASE
          WHEN client_hr_connections.status = 'connected' THEN 'connected'
          ELSE 'pending'
        END,
        last_requested_mode = EXCLUDED.last_requested_mode,
        message = EXCLUDED.message,
        updated_at = NOW()
      RETURNING *`,
      [clientId, hrId, mode, message || null]
    );

    res.status(200).json({
      message: "HR connection request saved successfully",
      connection: connectionResult.rows[0],
      hr: hrResult.rows[0],
    });
  } catch (error) {
    console.error("Error in connectToHr:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMyConnections = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        conn.connection_id,
        conn.status,
        conn.last_requested_mode,
        conn.message,
        conn.created_at,
        conn.updated_at,
        h.hr_id,
        h.name,
        h.email,
        h.phone,
        h.company_name,
        h.logo,
        h.profile_picture
      FROM client_hr_connections conn
      JOIN hr h
        ON h.hr_id = conn.hr_id
      WHERE conn.client_id = $1
      ORDER BY conn.updated_at DESC`,
      [req.user.client_id]
    );

    res.status(200).json({ connections: result.rows });
  } catch (error) {
    console.error("Error in getMyConnections:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const uploadProjectPdf = async (req, res) => {
  const clientId = req.user.client_id;
  const file = req.file;
  const { project_name, overview, hr_id } = req.body;

  if (!file) {
    return res.status(400).json({ message: "PDF file is required" });
  }

  const isPdf =
    file.mimetype === "application/pdf" ||
    file.originalname.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    return res.status(400).json({ message: "Only PDF uploads are supported" });
  }

  try {
    let selectedHrId = hr_id || null;

    const connectionResult = await pool.query(
      `SELECT hr_id
      FROM client_hr_connections
      WHERE client_id = $1
        AND status = 'connected'
      ORDER BY updated_at DESC`,
      [clientId],
    );

    const connectedHrIds = connectionResult.rows.map((row) => row.hr_id);

    if (!connectedHrIds.length) {
      return res.status(403).json({
        message:
          "You need an approved HR connection before uploading a project PDF",
      });
    }

    if (!selectedHrId && connectedHrIds.length === 1) {
      selectedHrId = connectedHrIds[0];
    }

    if (!selectedHrId || !connectedHrIds.includes(selectedHrId)) {
      return res.status(400).json({
        message: "Select an approved HR connection before uploading",
      });
    }

    const uploadId = randomUUID();
    const scopedDirectory = path.join(
      process.cwd(),
      "uploads",
      "clients",
      clientId,
      "hrs",
      selectedHrId,
      uploadId,
    );
    fs.mkdirSync(scopedDirectory, { recursive: true });
    const scopedPath = path.join(scopedDirectory, file.filename);
    fs.renameSync(file.path, scopedPath);
    file.path = scopedPath;

    const db = await pool.connect();

    try {
      await db.query("BEGIN");

      const activeConnection = await db.query(
        `SELECT 1 FROM client_hr_connections
         WHERE client_id = $1 AND hr_id = $2 AND status = 'connected'
         FOR SHARE`,
        [clientId, selectedHrId],
      );
      if (!activeConnection.rowCount) {
        await db.query("ROLLBACK");
        return res.status(403).json({ message: "The selected HR connection is no longer active" });
      }

      const result = await db.query(
        `INSERT INTO client_project_uploads (
          upload_id,
          client_id,
          hr_id,
          original_name,
          stored_name,
          file_path,
          project_name,
          overview
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          uploadId,
          clientId,
          selectedHrId,
          file.originalname,
          file.filename,
          file.path,
          project_name || null,
          overview || null,
        ],
      );

      await db.query("COMMIT");

      res.status(201).json({
        message: "Project PDF uploaded successfully",
        upload: result.rows[0],
        tasks: [],
      });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  } catch (error) {
    console.error("Error in uploadProjectPdf:", error.message);
    res.status(500).json({ message: error.message || "Internal Server Error" });
  }
};

export const getMyProjectUploads = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        u.upload_id,
        u.project_name,
        u.overview,
        u.original_name,
        u.upload_source,
        u.processing_status,
        u.confidence_flag,
        u.bot_raw_response,
        u.created_at,
        u.updated_at,
        h.hr_id,
        h.name AS hr_name,
        h.company_name AS hr_company_name,
        COALESCE(task_summary.task_count, 0)::INT AS task_count
      FROM client_project_uploads u
      LEFT JOIN hr h
        ON h.hr_id = u.hr_id
      LEFT JOIN (
        SELECT upload_id, COUNT(*) AS task_count
        FROM project_tasks
        GROUP BY upload_id
      ) task_summary
        ON task_summary.upload_id = u.upload_id
      WHERE u.client_id = $1
      ORDER BY u.created_at DESC`,
      [req.user.client_id]
    );

    res.status(200).json({ uploads: result.rows });
  } catch (error) {
    console.error("Error in getMyProjectUploads:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProjectFile = async (req, res) => {
  const { uploadId } = req.params;
  const user = req.user;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uploadId)) {
    return res.status(404).json({ message: "Project file not found" });
  }
  try {
    const result = await pool.query(
      `SELECT u.upload_id, u.file_path
       FROM client_project_uploads u
       WHERE u.upload_id = $1
         AND (
           ($2 = 'client' AND u.client_id = $3)
           OR ($2 = 'hr' AND u.hr_id = $4 AND EXISTS (
             SELECT 1 FROM client_hr_connections conn
             WHERE conn.client_id = u.client_id AND conn.hr_id = u.hr_id
               AND conn.status = 'connected'
           ))
           OR ($2 = 'employee' AND EXISTS (
             SELECT 1 FROM project_tasks t
             WHERE t.upload_id = u.upload_id AND t.assignee_emp_id = $5
           ))
         )`,
      [uploadId, user.role, user.client_id || null, user.hr_id || null, user.emp_id || null],
    );
    if (!result.rows.length) {
      return res.status(404).json({ message: "Project file not found" });
    }

    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const filePath = path.resolve(result.rows[0].file_path);
    const relativePath = path.relative(uploadsRoot, filePath);
    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath) || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Project file not found" });
    }
    res.type("application/pdf");
    res.setHeader("Content-Disposition", "inline");
    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) res.status(error.statusCode || 404).json({ message: "Project file not found" });
    });
  } catch (error) {
    console.error("Error in getProjectFile:", error.message);
    return res.status(500).json({ message: "Could not load project file" });
  }
};
