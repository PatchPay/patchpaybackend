
const express = require("express");

const {
  registerAdmin,
  loginAdmin,
  getCurrentAdmin,
} = require("../Controllers/adminAuthController");

const {
  authenticateAdmin,
  requireAdminRole,
} = require("../middlewares/adminMiddleware");

const router = express.Router();

/**
 * POST /api/admin/auth/register
 *
 * Register a new admin.
 *
 * This route is protected by ADMIN_REGISTRATION_SECRET.
 */
router.post("/register", registerAdmin);

/**
 * POST /api/admin/auth/login
 *
 * Login admin and receive JWT token.
 */
router.post("/login", loginAdmin);

/**
 * GET /api/admin/auth/me
 *
 * Get currently authenticated admin.
 */
router.get(
  "/me",
  authenticateAdmin,
  getCurrentAdmin
);

module.exports = router;

