const express = require("express");

const {
  getAllUsers,
  getUserStats,
  getUserById,
  suspendUser,
  reinstateUser,
  deleteUser,
} = require("../Controllers/adminUsersController");

const { authenticateAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

/**
 * GET /api/admin/users
 * Get all users
 */
router.get("/", authenticateAdmin, getAllUsers);

/**
 * GET /api/admin/users/stats
 * Get user statistics
 */
router.get("/stats", authenticateAdmin, getUserStats);

/**
 * GET /api/admin/users/:id
 * Get one user
 */
router.get("/:id", authenticateAdmin, getUserById);

/**
 * PATCH /api/admin/users/:id/suspend
 * Suspend user
 */
router.patch("/:id/suspend", authenticateAdmin, suspendUser);

/**
 * PATCH /api/admin/users/:id/reinstate
 * Reinstate suspended user
 */
router.patch("/:id/reinstate", authenticateAdmin, reinstateUser);

/**
 * DELETE /api/admin/users/:id
 * Delete user
 */
router.delete("/:id", authenticateAdmin, deleteUser);

module.exports = router;