const express = require("express");
const transferController = require("../Controllers/transfercontroller");
const { authenticateToken } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/banks", transferController.getBanks);
router.post("/account-lookup", transferController.accountLookup);
router.post("/internal", transferController.internalTransfer);
router.post("/external-bank", transferController.externalBankTransfer);
router.post("/withdrawal", transferController.withdrawal);
router.post("/initiate-payment", transferController.initiateTransferPayment);

router.post("/verify", transferController.verifyExternalTransfer);

module.exports = router;
