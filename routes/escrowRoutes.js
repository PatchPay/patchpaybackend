const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middlewares/authMiddleware");
const {
  validateEscrowCreation,
  checkEscrowPermission,
  checkEscrowAction,
} = require("../middlewares/escrowMiddleware");
const { uploadDeliveryProof } = require("../middlewares/uploadMiddleware");
const {
  createEscrow,
  getEscrows,
  getEscrowById,
  getMyEscrows,
  markEscrowDelivered,
  confirmEscrowReceipt,
  releaseEscrow,
  refundEscrow,
  disputeEscrow,
  cancelEscrow,
} = require("../Controllers/escrowController");

// Create a new escrow
router.post("/", authenticateToken, validateEscrowCreation, createEscrow);

// Get all escrows for the authenticated user
router.get("/", authenticateToken, getEscrows);

//Get escrow by the user either creator or recepient
router.get('/my-escrow', authenticateToken, getMyEscrows)

// Get a specific escrow by ID
router.get("/:id", authenticateToken, checkEscrowPermission, getEscrowById);

// Seller submits delivery proof (image) -> escrow becomes DELIVERED.
// Authorization/state are checked BEFORE multer parses the multipart body,
// so an unauthorized or wrong-state request never uploads a 5MB file.
router.post(
  "/:id/deliver",
  authenticateToken,
  checkEscrowPermission,
  checkEscrowAction("deliver"),
  uploadDeliveryProof,
  markEscrowDelivered,
);

// Buyer confirms receipt -> triggers automatic atomic release to the seller.
router.post(
  "/:id/confirm-receipt",
  authenticateToken,
  checkEscrowPermission,
  checkEscrowAction("confirm-receipt"),
  confirmEscrowReceipt,
);

// Release escrow funds (hardened: same guarded atomic release path)
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
