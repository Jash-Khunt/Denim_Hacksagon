import { pool } from "../lib/db.js";

export const getHrConnections = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        conn.connection_id,
        conn.status,
        conn.last_requested_mode,
        conn.message,
        conn.created_at,
        conn.updated_at,
        c.client_id,
        c.name,
        c.email,
        c.phone,
        c.company_name,
        c.profile_picture,
        c.address,
        COALESCE(upload_summary.upload_count, 0)::INT AS upload_count,
        COALESCE(task_summary.task_count, 0)::INT AS task_count
      FROM client_hr_connections conn
      JOIN client c
        ON c.client_id = conn.client_id
      LEFT JOIN (
        SELECT client_id, hr_id, COUNT(*) AS upload_count
        FROM client_project_uploads
        GROUP BY client_id, hr_id
      ) upload_summary
        ON upload_summary.client_id = conn.client_id
        AND upload_summary.hr_id = conn.hr_id
      LEFT JOIN (
        SELECT client_id, hr_id, COUNT(*) AS task_count
        FROM project_tasks
        GROUP BY client_id, hr_id
      ) task_summary
        ON task_summary.client_id = conn.client_id
        AND task_summary.hr_id = conn.hr_id
      WHERE conn.hr_id = $1
      ORDER BY
        CASE conn.status
          WHEN 'pending' THEN 0
          WHEN 'connected' THEN 1
          ELSE 2
        END,
        conn.updated_at DESC`,
      [req.user.hr_id],
    );

    res.status(200).json({ connections: result.rows });
  } catch (error) {
    console.error("Error in getHrConnections:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const respondToConnection = async (req, res) => {
  const { connectionId } = req.params;
  const { status } = req.body;

  if (!["connected", "declined"].includes(status)) {
    return res.status(400).json({ message: "Invalid connection status" });
  }

  try {
    const result = await pool.query(
      `UPDATE client_hr_connections
      SET status = $1, updated_at = NOW()
      WHERE connection_id = $2 AND hr_id = $3
      RETURNING *`,
      [status, connectionId, req.user.hr_id],
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Connection request not found" });
    }

    res.status(200).json({
      message:
        status === "connected"
          ? "Client connection approved"
          : "Client connection declined",
      connection: result.rows[0],
    });
  } catch (error) {
    console.error("Error in respondToConnection:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
