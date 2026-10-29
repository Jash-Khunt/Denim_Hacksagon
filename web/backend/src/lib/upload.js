import multer from "multer";
import fs from "fs";
import path from "path";

const uploadDir = "uploads";

// Create folder if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const clientId = req.user?.role === "client" && file.fieldname === "pdf"
      ? req.user.client_id
      : null;
    const hrId = req.user?.role === "hr" && file.fieldname === "company_files"
      ? req.user.hr_id
      : null;
    const destination = clientId
      ? path.join(uploadDir, ".pending", "clients", clientId)
      : hrId
        ? path.join(uploadDir, ".pending", "hr", hrId)
        : uploadDir;
    try {
      fs.mkdirSync(destination, { recursive: true });
      cb(null, destination);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    cb(
      null,
      `${file.fieldname}-${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${path.extname(file.originalname)}`
    );
  },
});

export const upload = multer({ storage });

const companyFileExtensions = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".txt", ".csv", ".rtf", ".png", ".jpg", ".jpeg", ".webp",
]);

const companyFileUploader = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!companyFileExtensions.has(extension)) {
      return callback(new Error("Unsupported file type. Upload PDF, Office, text, CSV, or image files."));
    }
    callback(null, true);
  },
});

export const uploadCompanyFiles = (req, res, next) => {
  companyFileUploader.array("company_files", 10)(req, res, (error) => {
    if (!error) return next();
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ message: error.message || "Could not upload files" });
  });
};
