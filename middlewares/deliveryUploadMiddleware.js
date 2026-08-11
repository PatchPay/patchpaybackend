const fs = require("fs");
const path = require("path");
const multer = require("multer");

const TEMP_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "delivery-proofs");
const MAX_DELIVERY_PROOF_SIZE_MB = 5;
const MAX_DELIVERY_PROOF_SIZE_BYTES =
  MAX_DELIVERY_PROOF_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

const sanitizeBaseName = (filename) => {
  const baseName = path.basename(filename, path.extname(filename));
  const sanitized = baseName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return sanitized || "delivery-proof";
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${sanitizeBaseName(file.originalname)}-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${extension}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(extension)) {
    return cb(null, true);
  }

  const error = new Error("Only JPEG, PNG, and WEBP images are allowed");
  error.code = "INVALID_DELIVERY_PROOF_TYPE";
  return cb(error);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_DELIVERY_PROOF_SIZE_BYTES,
    files: 1,
  },
});

const uploadDeliveryProof = (req, res, next) => {
  console.log("[delivery-upload] Incoming request", {
    escrowId: req.params.id,
    contentType: req.get("content-type"),
  });

  upload.single("deliveryProof")(req, res, (err) => {
    if (err) return next(err);

    if (req.file) {
      console.log("[delivery-upload] File received", {
        escrowId: req.params.id,
        fieldname: req.file.fieldname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    }

    return next();
  });
};

const removePartiallyUploadedFile = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("[delivery-upload] Failed to remove rejected file", {
        filePath,
        message: error.message,
      });
    }
  }
};

const handleDeliveryUploadError = async (err, req, res, next) => {
  if (!err) return next();

  console.warn("[delivery-upload] Upload error", {
    escrowId: req.params.id,
    code: err.code,
    field: err.field,
    message: err.message,
  });

  await removePartiallyUploadedFile(req.file?.path);

  if (err.code === "INVALID_DELIVERY_PROOF_TYPE") {
    return res.status(415).json({
      success: false,
      message: "Only JPEG, PNG, and WEBP images are allowed",
    });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: `Delivery proof image must be ${MAX_DELIVERY_PROOF_SIZE_MB}MB or smaller`,
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected file field. Use deliveryProof for the image.",
      });
    }

    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }

  return res.status(400).json({
    success: false,
    message: "Failed to process delivery proof upload",
  });
};

module.exports = {
  uploadDeliveryProof,
  handleDeliveryUploadError,
  TEMP_UPLOAD_DIR,
  MAX_DELIVERY_PROOF_SIZE_MB,
};
