import { pool } from "../lib/db.js";
import { createTasksFromBotOutput, parseBotTasks } from "../lib/task-workflow.js";

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
  const { project_name, overview, hr_id, bot_response } = req.body;

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

    const db = await pool.connect();

    try {
      await db.query("BEGIN");

      const result = await db.query(
        `INSERT INTO client_project_uploads (
          client_id,
          hr_id,
          original_name,
          stored_name,
          file_path,
          project_name,
          overview
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          clientId,
          selectedHrId,
          file.originalname,
          file.filename,
          file.path,
          project_name || null,
          overview || null,
        ],
      );

      let createdTasks = [];

      if (bot_response && bot_response.trim()) {
        const parsedTasks = parseBotTasks(bot_response);
        createdTasks = await createTasksFromBotOutput({
          db,
          uploadId: result.rows[0].upload_id,
          clientId,
          hrId: selectedHrId,
          createdByRole: "client",
          rawResponse: bot_response,
          tasks: parsedTasks,
        });
      }

      await db.query("COMMIT");

      res.status(201).json({
        message: createdTasks.length
          ? "Project PDF uploaded and tickets created successfully"
          : "Project PDF uploaded successfully",
        upload: result.rows[0],
        tasks: createdTasks,
      });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  } catch (error) {
    console.error("Error in uploadProjectPdf:", error.message);
    const statusCode =
      error.message?.includes("Tickets have already been created") ||
      error.message?.includes("Could not parse") ||
      error.message?.includes("No tasks found")
        ? 400
        : 500;
    res
      .status(statusCode)
      .json({ message: error.message || "Internal Server Error" });
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
        u.file_path,
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
