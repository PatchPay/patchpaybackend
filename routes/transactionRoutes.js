const express = require("express");
const router = express.Router();

const {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  getUserTransactions,
} = require("../Controllers/transactionController");

// ── Routes ─────────────────────────────────────────

// GET all transactions
router.get("/", getAllTransactions);

router.get("/user/:userId", getUserTransactions);

// GET single transaction by ID
router.get("/:id", getTransactionById);

// CREATE a transaction
router.post("/create", createTransaction);

module.exports = router;
