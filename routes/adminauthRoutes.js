const express = require("express");
const router = express.Router();

const adminAuthController = require("../Controllers/adminAuthController");
const { authenticateAdmin } = require("../middlewares/adminMiddleware");

/**
 * POST /api/admin/auth/register
 *
 * Register a new admin.
 */
router.post(
  "/register",
  adminAuthController.registerAdmin
);

/**
 * POST /api/admin/auth/login
 *
 * Login admin and receive JWT token.
 */
router.post(
  "/login",
  adminAuthController.loginAdmin
);

/**
 * GET /api/admin/auth/me
 *
 * Get currently authenticated admin.
 */
router.get(
  "/me",
  authenticateAdmin,
  adminAuthController.getCurrentAdmin
);

module.exports = router;