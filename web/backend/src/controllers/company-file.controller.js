import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { pool } from "../lib/db.js";

const removeFiles = (files) => {
  for (const file of files) {
    try {
      fs.unlinkSync(file);
    } catch {
      // Ignore cleanup errors; the files are still private and unregistered.
    }
  }
};

export const getCompanyFiles = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT file_id, original_name, file_size, created_at
       FROM hr_company_files
       WHERE hr_id = $1
       ORDER BY created_at DESC`,
      [req.user.hr_id],
    );
    return res.status(200).json({ files: rows });
  } catch (error) {
    console.error("Error in getCompanyFiles:", error.message);
    return res.status(500).json({ message: "Could not load company files" });
  }
};

export const saveCompanyFiles = async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ message: "Choose at least one file to upload" });
  }
  if (files.some((file) => file.originalname.length > 255)) {
    removeFiles(files.map((file) => file.path));
    return res.status(400).json({ message: "File names must be 255 characters or fewer" });
  }

  const hrId = req.user.hr_id;
  const stagedFiles = [];
  let db;
  try {
    db = await pool.connect();
    for (const file of files) {
      const fileId = randomUUID();
      const destinationDirectory = path.join(
        process.cwd(), "uploads", "hr-companies", hrId, fileId,
      );
      fs.mkdirSync(destinationDirectory, { recursive: true });
      const destinationPath = path.join(destinationDirectory, file.filename);
      fs.renameSync(file.path, destinationPath);
      stagedFiles.push({
        fileId,
        file,
        filePath: destinationPath,
      });
    }

    await db.query("BEGIN");
    const savedFiles = [];
    for (const staged of stagedFiles) {
      const result = await db.query(
        `INSERT INTO hr_company_files
          (file_id, hr_id, original_name, stored_name, file_path, file_size)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING file_id, original_name, file_size, created_at`,
        [
          staged.fileId,
          hrId,
          staged.file.originalname,
          staged.file.filename,
          staged.filePath,
          staged.file.size,
        ],
      );
      savedFiles.push(result.rows[0]);
    }
    await db.query("COMMIT");
    return res.status(201).json({ files: savedFiles });
  } catch (error) {
    if (db) await db.query("ROLLBACK").catch(() => {});
    removeFiles([
      ...files.map((file) => file.path),
      ...stagedFiles.map((staged) => staged.filePath),
    ]);
    console.error("Error in saveCompanyFiles:", error.message);
    return res.status(500).json({ message: "Could not save company files" });
  } finally {
    db?.release();
  }
};

export const downloadCompanyFile = async (req, res) => {
  const { fileId } = req.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
    return res.status(404).json({ message: "Company file not found" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT file_path, original_name
       FROM hr_company_files
       WHERE file_id = $1 AND hr_id = $2`,
      [fileId, req.user.hr_id],
    );
    if (!rows.length) return res.status(404).json({ message: "Company file not found" });

    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const filePath = path.resolve(rows[0].file_path);
    const relativePath = path.relative(uploadsRoot, filePath);
    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath) || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Company file not found" });
    }
    return res.download(filePath, rows[0].original_name, (error) => {
      if (error && !res.headersSent) {
        res.status(error.statusCode || 404).json({ message: "Company file not found" });
      }
    });
  } catch (error) {
    console.error("Error in downloadCompanyFile:", error.message);
    return res.status(500).json({ message: "Could not download company file" });
  }
};

export const viewCompanyFile = async (req, res) => {
  const { fileId } = req.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
    return res.status(404).json({ message: "Company file not found" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT file_path, original_name
       FROM hr_company_files
       WHERE file_id = $1 AND hr_id = $2`,
      [fileId, req.user.hr_id],
    );
    if (!rows.length || path.extname(rows[0].original_name).toLowerCase() !== ".pdf") {
      return res.status(404).json({ message: "PDF preview not found" });
    }

    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const filePath = path.resolve(rows[0].file_path);
    const relativePath = path.relative(uploadsRoot, filePath);
    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath) || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Company file not found" });
    }

    res.type("application/pdf");
    res.setHeader("Content-Disposition", "inline");
    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        res.status(error.statusCode || 404).json({ message: "Could not preview company file" });
      }
    });
  } catch (error) {
    console.error("Error in viewCompanyFile:", error.message);
    return res.status(500).json({ message: "Could not preview company file" });
  }
};
