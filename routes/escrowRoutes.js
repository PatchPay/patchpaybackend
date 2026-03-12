const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middlewares/authMiddleware");
const {
  validateEscrowCreation,
  checkEscrowPermission,
  checkEscrowAction,
} = require("../middlewares/escrowMiddleware");
const {
  createEscrow,
  getEscrows,
  getEscrowById,
  fundEscrow,
  releaseEscrow,
  refundEscrow,
  disputeEscrow,
  cancelEscrow,
} = require("../Controllers/escrowController");

// Create a new escrow
router.post("/", authenticateToken, validateEscrowCreation, createEscrow);

// Get all escrows for the authenticated user
router.get("/", authenticateToken, getEscrows);

// Get a specific escrow by ID
router.get("/:id", authenticateToken, checkEscrowPermission, getEscrowById);

// Fund an escrow
router.post(
  "/:id/fund",
  authenticateToken,
  checkEscrowPermission,
  checkEscrowAction("fund"),
  fundEscrow,
);

// Release escrow funds
router.post(
  "/:id/release",
  authenticateToken,
  checkEscrowPermission,
  checkEscrowAction("release"),
  releaseEscrow,
);

// Refund escrow
router.post(
  "/:id/refund",
  authenticateToken,
  checkEscrowPermission,
  checkEscrowAction("refund"),
  refundEscrow,
);

// Dispute an escrow
router.post(
  "/:id/dispute",
  authenticateToken,
  checkEscrowPermission,
  checkEscrowAction("dispute"),
  disputeEscrow,
);

// Cancel an escrow
router.post(
  "/:id/cancel",
  authenticateToken,
  checkEscrowPermission,
  checkEscrowAction("cancel"),
  cancelEscrow,
);

module.exports = router;
