const cloudinary = require("../config/cloudinary");

/**
 * Upload an in-memory image buffer to Cloudinary.
 *
 * The buffer comes from multer memory storage — the raw bytes are streamed
 * straight to Cloudinary, so no temporary file is written to disk and no
 * client-supplied URL is ever trusted.
 *
 * @param {Buffer} buffer - Raw image bytes.
 * @param {string} folder - Cloudinary folder to store the asset in.
 * @returns {Promise<{ url: string, publicId: string }>}
 */
const uploadImageBuffer = (buffer, folder = "escrow-delivery-proofs") => {
  return new Promise((resolve, reject) => {
    if (!buffer || !buffer.length) {
      return reject(new Error("No image data provided for upload"));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result || !result.secure_url || !result.public_id) {
          return reject(new Error("Cloudinary upload returned no result"));
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Delete an image from Cloudinary by its public id.
 *
 * Used to clean up an uploaded asset when the surrounding DB transaction
 * fails (or a race is lost) so we never leave orphaned files behind.
 * Never throws — cleanup failures are logged and swallowed.
 *
 * @param {string} publicId
 * @returns {Promise<void>}
 */
const destroyImage = async (publicId) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (error) {
    // Best-effort cleanup — log without leaking anything sensitive.
    console.error(
      "Failed to delete orphaned Cloudinary asset:",
      publicId,
      error.message
    );
  }
};

module.exports = {
  uploadImageBuffer,
  destroyImage,
};
