import { pool } from "../lib/db.js";
import moment from "moment";

// Helper: get current IST moment
const istNow = () => moment().utcOffset("+05:30");

/**
 * Employee Check-In
 */
export const markAttendance = async (req, res) => {
  try {
    const emp_id = req.user.emp_id;
    const hr_id = req.user.hr_id || null;
    const today = istNow().format("YYYY-MM-DD");
    const now = istNow().format("HH:mm");

    // Insert attendance or update check_in if already exists
    const result = await pool.query(
      `
      INSERT INTO attendance (emp_id, hr_id, attendance_date, check_in, status)
      VALUES ($1, $2, $3, $4, 'Present')
      ON CONFLICT (emp_id, attendance_date)
      DO UPDATE SET check_in = EXCLUDED.check_in, status = 'Present'
      RETURNING *;
      `,
      [emp_id, hr_id, today, now]
    );

    res.json({
      attendance: result.rows[0],
    });
  } catch (error) {
    console.error("markAttendance error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Employee Check-Out
 */
export const checkOutAttendance = async (req, res) => {
  try {
    const emp_id = req.user.emp_id;
    const today = istNow().format("YYYY-MM-DD");
    const now = istNow().format("HH:mm");

    const result = await pool.query(
      `
      UPDATE attendance
      SET check_out = $1
      WHERE emp_id = $2 AND attendance_date = $3
      RETURNING *;
      `,
      [now, emp_id, today]
    );

    if (!result.rows.length)
      return res.status(404).json({ message: "No attendance found for today" });

    res.json({
      attendance: result.rows[0],
    });
  } catch (error) {
    console.error("checkOutAttendance error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Attendance stats for employee (or HR)
 */
export const getAttendanceStats = async (req, res) => {
  try {
    const emp_id = req.user.emp_id;
    const startOfMonth = istNow().startOf("month").format("YYYY-MM-DD");
    const endOfMonth = istNow().endOf("month").format("YYYY-MM-DD");

    const result = await pool.query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE status='Present') AS present,
        COUNT(*) FILTER (WHERE status='Absent') AS absent,
        COUNT(*) FILTER (WHERE status='Leave') AS leave,
        COALESCE(SUM(EXTRACT(EPOCH FROM (check_out::time - check_in::time))/3600),0) AS "totalHours"
      FROM attendance
      WHERE emp_id=$1 AND attendance_date BETWEEN $2 AND $3
      `,
      [emp_id, startOfMonth, endOfMonth]
    );

    const row = result.rows[0];
    res.json({
      present: parseInt(row.present) || 0,
      absent: parseInt(row.absent) || 0,
      leave: parseInt(row.leave) || 0,
      totalHours: parseFloat(row.totalHours) || 0,
    });
  } catch (error) {
    console.error("getAttendanceStats error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Weekly attendance
 */
export const getWeeklyAttendance = async (req, res) => {
  try {
    const emp_id = req.user.emp_id;
    const now = istNow();
    const startOfWeek = now.clone().startOf("isoWeek").format("YYYY-MM-DD");
    const endOfWeek = now.clone().endOf("isoWeek").format("YYYY-MM-DD");

    const result = await pool.query(
      `SELECT * FROM attendance WHERE emp_id=$1 AND attendance_date BETWEEN $2 AND $3 ORDER BY attendance_date ASC`,
      [emp_id, startOfWeek, endOfWeek]
    );

    res.json({ attendance: result.rows });
  } catch (error) {
    console.error("getWeeklyAttendance error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Daily attendance log (last 30 days)
 */
export const getDailyAttendance = async (req, res) => {
  try {
    const emp_id = req.user.emp_id;
    const startDate = istNow().subtract(30, "days").format("YYYY-MM-DD");
    const endDate = istNow().format("YYYY-MM-DD");

    const result = await pool.query(
      `SELECT * FROM attendance WHERE emp_id=$1 AND attendance_date BETWEEN $2 AND $3 ORDER BY attendance_date DESC`,
      [emp_id, startDate, endDate]
    );

    res.json({ attendance: result.rows });
  } catch (error) {
    console.error("getDailyAttendance error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Today's attendance status for the logged-in employee
 */
export const getTodayStatus = async (req, res) => {
  try {
    const emp_id = req.user.emp_id;
    const today = istNow().format("YYYY-MM-DD");

    const result = await pool.query(
      `SELECT * FROM attendance WHERE emp_id=$1 AND attendance_date=$2`,
      [emp_id, today]
    );

    const record = result.rows[0] || null;
    res.json({
      isCheckedIn: record ? (!!record.check_in && !record.check_out) : false,
      isCheckedOut: record ? (!!record.check_in && !!record.check_out) : false,
      checkInTime: record?.check_in || null,
      checkOutTime: record?.check_out || null,
      record,
    });
  } catch (error) {
    console.error("getTodayStatus error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ==================== HR ENDPOINTS ====================

/**
 * HR: Get all employees with today's attendance status
 */
export const getHREmployeesAttendance = async (req, res) => {
  try {
    const hr_id = req.user.hr_id;
    const today = istNow().format("YYYY-MM-DD");

    const result = await pool.query(
      `
      SELECT 
        e.emp_id,
        e.name,
        e.email,
        e.phone,
        e.profile_picture,
        p.department,
        a.attendance_id,
        a.attendance_date,
        a.check_in,
        a.check_out,
        a.status AS attendance_status
      FROM employee e
      LEFT JOIN profile_info p ON e.emp_id = p.emp_id
      LEFT JOIN attendance a ON e.emp_id = a.emp_id AND a.attendance_date = $2
      WHERE e.hr_id = $1
      ORDER BY e.name ASC
      `,
      [hr_id, today]
    );

    res.json({ employees: result.rows });
  } catch (error) {
    console.error("getHREmployeesAttendance error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * HR: Get weekly attendance for a specific employee
 */
export const getHREmployeeWeekly = async (req, res) => {
  try {
    const hr_id = req.user.hr_id;
    const { empId } = req.params;
    const now = istNow();
    const startOfWeek = now.clone().startOf("isoWeek").format("YYYY-MM-DD");
    const endOfWeek = now.clone().endOf("isoWeek").format("YYYY-MM-DD");

    // Verify employee belongs to this HR
    const empCheck = await pool.query(
      `SELECT emp_id FROM employee WHERE emp_id = $1 AND hr_id = $2`,
      [empId, hr_id]
    );
    if (!empCheck.rows.length) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await pool.query(
      `SELECT * FROM attendance WHERE emp_id=$1 AND attendance_date BETWEEN $2 AND $3 ORDER BY attendance_date ASC`,
      [empId, startOfWeek, endOfWeek]
    );

    res.json({ attendance: result.rows });
  } catch (error) {
    console.error("getHREmployeeWeekly error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * HR: Get daily attendance for a specific employee (last 30 days)
 */
export const getHREmployeeDaily = async (req, res) => {
  try {
    const hr_id = req.user.hr_id;
    const { empId } = req.params;
    const startDate = istNow().subtract(30, "days").format("YYYY-MM-DD");
    const endDate = istNow().format("YYYY-MM-DD");

    // Verify employee belongs to this HR
    const empCheck = await pool.query(
      `SELECT emp_id FROM employee WHERE emp_id = $1 AND hr_id = $2`,
      [empId, hr_id]
    );
    if (!empCheck.rows.length) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await pool.query(
      `SELECT * FROM attendance WHERE emp_id=$1 AND attendance_date BETWEEN $2 AND $3 ORDER BY attendance_date DESC`,
      [empId, startDate, endDate]
    );

    res.json({ attendance: result.rows });
  } catch (error) {
    console.error("getHREmployeeDaily error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
