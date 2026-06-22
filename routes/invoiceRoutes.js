const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middlewares/authMiddleware");
const invoiceController = require("../Controllers/invoiceController");

/**
 * ======================================================
 * PUBLIC ROUTES (NO AUTH)
 * ======================================================
 */

// Callback MUST be public (Squad redirects here)
router.get("/callback", invoiceController.handleInvoiceCallback);

// Public verify (used by callback button / testing UI)
router.post("/verify-payment", invoiceController.verifyInvoicePayment);

/**
 * ======================================================
 * PROTECT EVERYTHING BELOW
 * ======================================================
 */
router.use(authenticateToken);

/**
 * ======================================================
 * AUTH PROTECTED ROUTES
 * ======================================================
 */

router.post(
  "/generate-invoice/:quoteId",
  invoiceController.createInvoiceFromAcceptedQuote
);

router.get(
  "/:invoiceId",
  invoiceController.getInvoiceById
);

router.post(
  "/:invoiceId/initiate-payment",
  invoiceController.initiateInvoicePayment
);

module.exports = router;