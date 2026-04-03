import { pool } from "../lib/db.js";

/**
 * 1️⃣ Update Image (Logo or Profile Picture)
 */
export const updateImage = async (req, res) => {
  try {
    const { role } = req.user;
    const userId = req.user.hr_id || req.user.emp_id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const type = file.fieldname; // logo | profile_picture

    if (role === "employee" && type === "logo") {
      return res
        .status(403)
        .json({ message: "Employees cannot update company logo" });
    }

    if (type === "logo" && role === "hr") {
      await pool.query(`UPDATE hr SET logo = $1 WHERE hr_id = $2`, [
        file.path,
        userId,
      ]);
      return res.json({ message: "Company logo updated", imageUrl: file.path });
    }

    const table = role === "hr" ? "hr" : "employee";
    const idCol = role === "hr" ? "hr_id" : "emp_id";

    await pool.query(
      `UPDATE ${table} SET profile_picture = $1 WHERE ${idCol} = $2`,
      [file.path, userId]
    );

    return res.json({
      message: "Profile picture updated",
      imageUrl: file.path,
    });
  } catch (error) {
    console.error("Error updateImage:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * 2️⃣ Update Profile
 */
export const updateProfile = async (req, res) => {
  const { role } = req.user;
  const requesterId = req.user.hr_id || req.user.emp_id;

  const targetId =
    role === "hr" && req.body.target_id ? req.body.target_id : requesterId;

  try {
    // ===========================
    // HR UPDATE
    // ===========================
    if (role === "hr") {
      const {
        department,
        location,
        summary,
        skills,
        salary,
        date_of_birth,
        address,
        nationality,
        gender,
        marital_status,
        bank_name,
        account_number,
        ifsc_code,
        pan_no,
        emp_code,
        name,
        phone,
      } = req.body;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        await client.query(
          `
          INSERT INTO profile_info (
            hr_id, emp_id, department, location, summary, skills, salary,
            date_of_birth, address, nationality, gender, marital_status,
            bank_name, account_number, ifsc_code, pan_no, emp_code, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17, NOW()
          )
          ON CONFLICT (emp_id, hr_id)
          DO UPDATE SET
            department = EXCLUDED.department,
            location = EXCLUDED.location,
            summary = EXCLUDED.summary,
            skills = EXCLUDED.skills,
            salary = EXCLUDED.salary,
            date_of_birth = EXCLUDED.date_of_birth,
            address = EXCLUDED.address,
            nationality = EXCLUDED.nationality,
            gender = EXCLUDED.gender,
            marital_status = EXCLUDED.marital_status,
            bank_name = EXCLUDED.bank_name,
            account_number = EXCLUDED.account_number,
            ifsc_code = EXCLUDED.ifsc_code,
            pan_no = EXCLUDED.pan_no,
            emp_code = EXCLUDED.emp_code,
            updated_at = NOW()
        `,
          [
            requesterId,
            targetId,
            department,
            location,
            summary,
            skills,
            salary,
            date_of_birth,
            address,
            nationality,
            gender,
            marital_status,
            bank_name,
            account_number,
            ifsc_code,
            pan_no,
            emp_code,
          ]
        );

        if (name || phone) {
          await client.query(
            `UPDATE employee SET 
              name = COALESCE($1, name), 
              phone = COALESCE($2, phone)
             WHERE emp_id = $3`,
            [name, phone, targetId]
          );
        }

        await client.query("COMMIT");
        client.release();

        // Fetch and return the updated profile
        const profileResult = await pool.query(
          `SELECT e.name, e.phone, e.email, e.profile_picture, p.* 
           FROM employee e
           LEFT JOIN profile_info p ON e.emp_id = p.emp_id
           WHERE e.emp_id = $1`,
          [targetId]
        );

        return res.json({ user: profileResult.rows[0] || {}, message: "Profile updated successfully" });
      } catch (err) {
        await client.query("ROLLBACK");
        client.release();
        throw err;
      }
    }

    // ===========================
    // EMPLOYEE UPDATE
    // ===========================
    const forbiddenFields = [
      "salary",
      "department",
      "bank_name",
      "account_number",
      "ifsc_code",
      "pan_no",
      "emp_code",
      "gender",
      "marital_status",
      "nationality",
      "date_of_birth",
    ];

    const forbiddenUsed = forbiddenFields.filter(
      (field) => req.body[field] !== undefined
    );

    if (forbiddenUsed.length > 0) {
      return res.status(403).json({
        message: "You are not allowed to update these fields",
        fields: forbiddenUsed,
      });
    }

    const allowedFields = ["address", "phone"];
    const updates = [];
    const values = [];
    let idx = 1;

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx}`);
        values.push(req.body[field]);
        idx++;
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        message: "No updatable fields provided",
      });
    }

    values.push(targetId);

    await pool.query(
      `UPDATE profile_info 
       SET ${updates.join(", ")}, updated_at = NOW() 
       WHERE emp_id = $${idx}`,
      values
    );

    if (req.body.phone) {
      await pool.query(
        `UPDATE employee SET phone = $1 WHERE emp_id = $2`,
        [req.body.phone, targetId]
      );
    }

    // Fetch and return the updated profile
    const profileResult = await pool.query(
      `SELECT e.name, e.phone, e.email, e.profile_picture, p.* 
       FROM employee e
       LEFT JOIN profile_info p ON e.emp_id = p.emp_id
       WHERE e.emp_id = $1`,
      [targetId]
    );

    return res.json({ user: profileResult.rows[0] || {}, message: "Personal details updated successfully" });
  } catch (error) {
    console.error("Error updateProfile:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * 3️⃣ Get Profile
 */
export const getProfile = async (req, res) => {
  const id = req.params.id || req.user.hr_id || req.user.emp_id;

  try {
    let result = await pool.query(
      `SELECT e.name, e.phone, e.email, e.profile_picture, p.* 
       FROM employee e
       LEFT JOIN profile_info p ON e.emp_id = p.emp_id
       WHERE e.emp_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        `SELECT h.name, h.phone, h.email, h.profile_picture, h.logo, h.company_name, p.*
         FROM hr h
         LEFT JOIN profile_info p ON h.hr_id = p.hr_id
         WHERE h.hr_id = $1`,
        [id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Error getProfile:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
