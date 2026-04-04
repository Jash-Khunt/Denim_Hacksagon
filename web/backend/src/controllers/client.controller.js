import { pool } from "../lib/db.js";

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

    if (selectedHrId) {
      const hrResult = await pool.query(
        "SELECT hr_id FROM hr WHERE hr_id = $1",
        [selectedHrId]
      );

      if (hrResult.rows.length === 0) {
        return res.status(404).json({ message: "Selected HR not found" });
      }
    }

    const result = await pool.query(
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
      ]
    );

    res.status(201).json({
      message: "Project PDF uploaded successfully",
      upload: result.rows[0],
    });
  } catch (error) {
    console.error("Error in uploadProjectPdf:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
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
        u.created_at,
        u.updated_at,
        h.hr_id,
        h.name AS hr_name,
        h.company_name AS hr_company_name
      FROM client_project_uploads u
      LEFT JOIN hr h
        ON h.hr_id = u.hr_id
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
