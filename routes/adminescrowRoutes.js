const express = require("express");

const router = express.Router();

const {
  getAllEscrows,
  getEscrowById,
  getEscrowStats,
} = require("../Controllers/adminescrowController");

const {
  authenticateAdmin,
//   requireAdminRole,
} = require("../middlewares/adminMiddleware");

/**
 * GET ALL ESCROWS
 * GET /api/admin/escrows
 */
router.get(
  "/",
  authenticateAdmin,
//   requireAdminRole,
  getAllEscrows
);

/**
 * GET ESCROW STATS
 * GET /api/admin/escrows/stats
 */
router.get(
  "/stats",
  authenticateAdmin,
//   requireAdminRole,
  getEscrowStats
);

/**
 * GET SINGLE ESCROW
 * GET /api/admin/escrows/:id
 */
router.get(
  "/:id",
  authenticateAdmin,
//   requireAdminRole,
  getEscrowById
);

module.exports = router;