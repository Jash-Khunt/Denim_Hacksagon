import bcrypt from "bcryptjs";
import { pool } from "../lib/db.js";
import { generateToken } from "../lib/utils.js";

export const registerHr = async (req, res) => {
  console.log("BODY:", req.body);
  console.log("FILES:", req.files);

  const { name, phone, email, password, company_name } = req.body;

  // Handle Files
  // req.files is an object because we use upload.fields() in the route
  const logoPath = req.files["logo"] ? req.files["logo"][0].path : null;
  const profilePicPath = req.files["profile_picture"]
    ? req.files["profile_picture"][0].path
    : null;

  if (!logoPath) {
    return res.status(400).json({ message: "Company Logo is required" });
  }

  try {
    const existingHr = await pool.query("SELECT * FROM hr WHERE email = $1", [
      email,
    ]);
    if (existingHr.rows.length > 0)
      return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO hr (name, phone, email, password_hash, company_name, logo, profile_picture) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        name,
        phone,
        email,
        hashedPassword,
        company_name,
        logoPath,
        profilePicPath,
      ]
    );

    // Create empty profile_info for HR
    await pool.query(`INSERT INTO profile_info (hr_id) VALUES ($1)`, [
      result.rows[0].hr_id,
    ]);

    generateToken(result.rows[0].hr_id, res);

    // Remove password before sending back
    const { password_hash: pass, ...userWithoutPass } = result.rows[0];
    res.status(201).json({ user: userWithoutPass, role: "hr" });
  } catch (error) {
    console.log("Error in registerHr:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Check HR
    let result = await pool.query(
      "SELECT *, 'hr' as role FROM hr WHERE email = $1",
      [email]
    );
    let user = result.rows[0];
    let idField = "hr_id";

    // 2. If not HR, Check Employee
    if (!user) {
      result = await pool.query(
        "SELECT *, 'employee' as role FROM employee WHERE email = $1",
        [email]
      );
      user = result.rows[0];
      idField = "emp_id";
    }

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    generateToken(user[idField], res);

    // Return user info (frontend will use 'logo' or 'profile_picture' from here)
    const { password_hash: pass, ...userWithoutPass } = user;
    res.status(200).json({ user: userWithoutPass, role: user.role });
  } catch (error) {
    console.log("Error login:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.status(200).json({ message: "Logged out successfully" });
};

export const getMe = (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.status(200).json({ user: req.user });
  } catch (error) {
    console.log("Error in getMe:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
