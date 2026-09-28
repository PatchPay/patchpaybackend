const express = require("express");

const router = express.Router();

const {
  getAllRfqs,
} = require("../Controllers/adminRfq");

const {
  authenticateAdmin,

} = require("../middlewares/adminMiddleware");

/**
 * GET ALL RFQs
 * GET /api/admin/rfqs
 */
router.get(
  "/",
  authenticateAdmin,

  getAllRfqs
);

module.exports = router;