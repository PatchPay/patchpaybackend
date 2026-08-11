const multer = require("multer");

// Accept only real image uploads; the actual bytes are validated by
// Cloudinary on upload, but we gate on mimetype up front to reject
// obviously-wrong files before spending a network round-trip.
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Memory storage: the file lives only as a Buffer on req.file.buffer and is
// streamed to Cloudinary. Nothing touches local disk, and no client-supplied
// URL is ever trusted as the source of the image.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }

  const error = new Error(
    "Unsupported file type. Only JPEG, PNG and WEBP images are allowed."
  );
  error.code = "UNSUPPORTED_FILE_TYPE";
  return cb(error, false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

/**
 * Middleware that parses a single `deliveryProof` image field and maps multer
 * errors to clean JSON responses:
 *   - file too large           -> 400
 *   - unsupported file type     -> 415
 *   - any other multer error    -> 400
 *
 * Without this wrapper, multer errors would fall through to server.js's
 * generic handler and surface as a 500.
 */
const uploadDeliveryProof = (req, res, next) => {
  const handler = upload.single("deliveryProof");

  handler(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Delivery proof image must be 5MB or smaller",
        });
      }

      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    }

    if (err.code === "UNSUPPORTED_FILE_TYPE") {
      return res.status(415).json({
        success: false,
        message: err.message,
      });
    }

    // Unexpected error — surface a safe message.
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to process uploaded file",
    });
  });
};

module.exports = {
  uploadDeliveryProof,
};
