import jwt from "jsonwebtoken";
import { pool } from "../lib/db.js";

const getEmployeeAuthSelect = () => `
  SELECT
    emp_id,
    hr_id,
    name,
    phone,
    email,
    password_hash,
    profile_picture,
    role AS employee_role,
    experience,
    created_at,
    updated_at,
    'employee' AS role
  FROM employee
`;

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No Token Provided" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }

    const id = decoded.userid;

    // Try HR first
    let result = await pool.query(
      "SELECT *, 'hr' as role FROM hr WHERE hr_id = $1",
      [id],
    );
    let user = result.rows[0];

    // If not HR, try employee
    if (!user) {
      result = await pool.query(
        `${getEmployeeAuthSelect()} WHERE emp_id = $1`,
        [id],
      );
      user = result.rows[0];
    }

    // If not Employee, try Client
    if (!user) {
      result = await pool.query(
        `SELECT
          client_id,
          name,
          phone,
          email,
          password_hash,
          company_name,
          profile_picture,
          address,
          created_at,
          updated_at,
          'client' AS role
        FROM client
        WHERE client_id = $1`,
        [id],
      );
      user = result.rows[0];
    }

    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }

    // remove password_hash before attaching
    const { password_hash, ...userWithoutPass } = user;
    req.user = userWithoutPass;
    next();
  } catch (error) {
    console.log("Error in protectRoute middleware:", error.message);

    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res
        .status(401)
        .json({ message: "Unauthorized - Invalid or Expired Token" });
    }

    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};
