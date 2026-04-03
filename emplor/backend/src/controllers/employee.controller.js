import bcrypt from "bcryptjs";
import { pool } from "../lib/db.js";

export const addEmployee = async (req, res) => {
  const { name, phone, email, password } = req.body;
  const hr_id = req.user.hr_id;
  const profilePicPath = req.file ? req.file.path : null; // Handle uploaded file

  try {
    const existingEmp = await pool.query(
      "SELECT * FROM employee WHERE email = $1",
      [email],
    );
    if (existingEmp.rows.length > 0)
      return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const empResult = await client.query(
        `INSERT INTO employee (hr_id, name, phone, email, password_hash, profile_picture) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [hr_id, name, phone, email, hashedPassword, profilePicPath],
      );

      await client.query(
        `INSERT INTO profile_info (emp_id, hr_id) VALUES ($1, $2)`,
        [empResult.rows[0].emp_id, hr_id],
      );

      await client.query("COMMIT");
      res.status(201).json({ employee: empResult.rows[0] });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.log("Error addEmployee:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllEmployees = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.emp_id, e.name, e.email, e.phone, e.profile_picture, p.department 
       FROM employee e 
       LEFT JOIN profile_info p ON e.emp_id = p.emp_id 
       WHERE e.hr_id = $1`,
      [req.user.hr_id],
    );
    res.status(200).json({ employees: result.rows });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
