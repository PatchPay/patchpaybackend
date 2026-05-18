const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");

const {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  getUserTransactions,
} = require("../Controllers/transactionController");

router.use(authMiddleware);

// ── Routes ─────────────────────────────────────────

// GET all transactions
router.get("/", getAllTransactions);

router.get("/user/:userId", getUserTransactions);

// GET single transaction by ID
router.get("/:id", getTransactionById);

// CREATE a transaction
router.post("/create", createTransaction);

module.exports = router;
