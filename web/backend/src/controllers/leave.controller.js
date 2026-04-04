import {pool} from "../lib/db.js";

// Create leave request
export const createLeaveRequest = async (req, res) => {
  const empId  = req.user.emp_id; // From auth middleware
  const { type, startDate, endDate, remarks } = req.body;
  // Capitalize to match DB CHECK constraint: 'Paid', 'Sick', 'Unpaid', 'Half-Day'
  const leaveType = type ? type.charAt(0).toUpperCase() + type.slice(1) : type;

  try {
    const result = await pool.query(
      `INSERT INTO time_off(emp_id, leave_type, start_date, end_date, admin_comment)
       VALUES($1, $2, $3, $4, $5) RETURNING *`,
      [empId, leaveType, startDate, endDate, remarks || null]
    );
    res.status(201).json({ leave: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create leave request" });
  }
};

// Get own leaves
export const getMyLeaves = async (req, res) => {
  const empId  = req.user.emp_id;

  try {
    const result = await pool.query(
      `SELECT * FROM time_off WHERE emp_id = $1 ORDER BY created_at DESC`,
      [empId]
    );
    res.json({ leaves: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch leaves" });
  }
};

// Admin: get all leave requests
export const getAllLeaves = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, e.name AS user_name 
       FROM time_off t
       JOIN employee e ON t.emp_id = e.emp_id
       ORDER BY t.created_at DESC`
    );
    res.json({ leaves: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch all leave requests" });
  }
};

// Approve leave
export const approveLeave = async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  try {
    const result = await pool.query(
      `UPDATE time_off SET status='Approved', admin_comment=$1
       WHERE request_id=$2 RETURNING *`,
      [comment || null, id]
    );
    res.json({ leave: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve leave" });
  }
};

// Reject leave
export const rejectLeave = async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  try {
    const result = await pool.query(
      `UPDATE time_off SET status='Rejected', admin_comment=$1
       WHERE request_id=$2 RETURNING *`,
      [comment || null, id]
    );
    res.json({ leave: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reject leave" });
  }
};
