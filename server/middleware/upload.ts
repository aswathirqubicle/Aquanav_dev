import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const storage_multer = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine directory based on route
    let uploadDir = "uploads/payment-files";
    if (req.originalUrl?.includes("/api/customers")) {
      uploadDir = "uploads/customer-documents";
    } else if (req.originalUrl?.includes("/api/suppliers")) {
      uploadDir = "uploads/supplier-documents";
    } else if (req.originalUrl?.includes("/photo-groups")) {
      uploadDir = "uploads/projects/photogroups";
    } else if (req.originalUrl?.includes("/api/projects")) {
      uploadDir = "uploads/projects/vesselimage";
    } else if (req.originalUrl?.includes("/api/employees")) {
      uploadDir = "uploads/employee-documents";
    } else if (req.originalUrl?.includes("/api/company")) {
      uploadDir = "uploads/company";
    } else if (req.originalUrl?.includes("/api/purchase-orders")) {
      uploadDir = "uploads/purchase-order";
    } else if (req.originalUrl?.includes("/api/purchase-invoices")) {
      uploadDir = "uploads/purchase-invoice";
    } else if (req.originalUrl?.includes("reimbursements")) {
      uploadDir = "uploads/reimbursements";
    } else if (req.originalUrl?.includes("/api/print")) {
      uploadDir = "uploads/report";
    }

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

export const upload = multer({
  storage: storage_multer,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check if the route is for photo group uploads, which should be stricter
    if (req.originalUrl.includes("/photo-groups")) {
      const allowedImageTypes = /jpeg|jpg|png|gif/;
      const isImage =
        allowedImageTypes.test(path.extname(file.originalname).toLowerCase()) &&
        allowedImageTypes.test(file.mimetype);
      if (isImage) {
        cb(null, true);
      } else {
        cb(
          new Error(
            "Only image files (jpeg, jpg, png, gif) are allowed for photo groups.",
          ),
        );
      }
    } else {
      // For other routes, allow documents as well
      const allowedGeneralTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
      const isAllowed =
        allowedGeneralTypes.test(
          path.extname(file.originalname).toLowerCase(),
        ) && allowedGeneralTypes.test(file.mimetype);
      if (isAllowed) {
        cb(null, true);
      } else {
        cb(
          new Error(
            "Invalid file type. Allowed types include images and common documents.",
          ),
        );
      }
    }
  },
});
