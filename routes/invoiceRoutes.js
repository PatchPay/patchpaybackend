const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middlewares/authMiddleware");
const invoiceController = require("../Controllers/invoiceController");

router.post(
  "/create-from-accepted-quote/:quoteId",
  authenticateToken,
  invoiceController.createInvoiceFromAcceptedQuote,
);

router.get("/:invoiceId", authenticateToken, invoiceController.getInvoiceById);

router.post(
  "/:invoiceId/initiate-payment",
  authenticateToken,
  invoiceController.initiateInvoicePayment,
);

router.post(
  "/verify-payment",
  authenticateToken,
  invoiceController.verifyInvoicePayment,
);

module.exports = router;
