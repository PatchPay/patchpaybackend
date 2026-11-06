
const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middlewares/authMiddleware");
const invoiceController = require("../Controllers/invoiceController");

// Protect all invoice routes
router.use(authenticateToken);

// Generate invoice from accepted quote
router.post(
  "/generate-invoice/:quoteId",
  invoiceController.createInvoiceFromAcceptedQuote
);

// Get invoice details
router.get(
  "/:invoiceId",
  invoiceController.getInvoiceById
);

// Pay invoice using wallet + transaction PIN
router.post(
  "/:invoiceId/initiate-payment",
  invoiceController.initiateInvoicePayment
);

module.exports = router;
