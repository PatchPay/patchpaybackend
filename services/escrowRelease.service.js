const sequelize = require("../config/database");
const Escrow = require("../models/Escrow");
const Quote = require("../models/Quote");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const EscrowTransaction = require("../models/EscrowTransaction");
const { creditWallet } = require("./wallet.service");
const { generateEscrowTransferUPRN } = require("../utils/paymentUtils");

/**
 * Build a typed error with an HTTP status code attached.
 */
const httpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Atomically confirm buyer receipt and release escrow funds to the seller.
 *
 * The whole operation runs in a single Postgres transaction. The escrow row is
 * locked with SELECT ... FOR UPDATE (LOCK.UPDATE) so two concurrent confirms
 * serialize: the first commits and flips the row to RELEASED, the second
 * re-reads the locked row, sees it is no longer DELIVERED / already has a
 * release transaction, and aborts. A deterministic idempotencyKey
 * (`escrow-release-<id>`) on the Transaction is a hard DB-level backstop that
 * guarantees at most one release transaction per escrow even if every other
 * guard were bypassed.
 *
 * Trust model: neither the seller wallet, amount, nor recipient come from the
 * client. They are derived from the locked escrow row and looked up server-side.
 *
 * @param {number|string} escrowId - Escrow id from the route param.
 * @param {number|string} buyerId  - Authenticated user id (req.user.id).
 * @returns {Promise<Escrow>} The updated escrow instance.
 */
const confirmReceiptAndRelease = async (escrowId, buyerId) => {
  return sequelize.transaction(async (t) => {
    // 1. Lock the escrow row for the duration of the transaction.
    const escrow = await Escrow.findByPk(escrowId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!escrow) {
      throw httpError(404, "Escrow not found");
    }

    // 2. Guards evaluated on the LOCKED row (never on a stale copy).
    if (String(escrow.creatorId) !== String(buyerId)) {
      throw httpError(403, "Only the buyer can confirm receipt");
    }

    // Idempotent short-circuit: already released -> report conflict, pay nothing.
    if (
      escrow.status === "RELEASED" ||
      escrow.releaseTransactionId != null ||
      escrow.buyerReceived === true
    ) {
      throw httpError(409, "Escrow funds have already been released");
    }

    if (escrow.status !== "DELIVERED") {
      throw httpError(
        400,
        "Receipt can only be confirmed after the seller marks the escrow as delivered"
      );
    }

    if (!escrow.deliveryProofUrl || !escrow.sellerDeliveredAt) {
      throw httpError(
        400,
        "Delivery proof has not been submitted by the seller"
      );
    }

    const releaseAmount = Number(escrow.currentBalance || 0);
    if (!(releaseAmount > 0)) {
      throw httpError(400, "Escrow has no funds available to release");
    }

    console.log(
      `[escrow-release] Releasing escrow ${escrow.id} (${escrow.escrowUprn}) to seller ${escrow.recipientId}`
    );

    // 3. Resolve the seller's active wallet in the escrow currency.
    const sellerWallet = await Wallet.findOne({
      where: {
        userId: escrow.recipientId,
        currency: escrow.currency,
        isActive: true,
      },
      transaction: t,
    });

    if (!sellerWallet) {
      // Rolls back — escrow stays DELIVERED and the buyer can retry later.
      throw httpError(404, "Seller wallet not found for escrow currency");
    }

    // 4. Create the wallet-level release transaction (money entering seller).
    const releaseReference = generateEscrowTransferUPRN(
      escrow.recipientId,
      escrow.id,
      "release"
    );

    const releaseTransaction = await Transaction.create(
      {
        type: "escrow_release",
        amount: releaseAmount,
        fee: 0,
        currency: escrow.currency,
        status: "completed",
        recipientWallet: sellerWallet.id,
        recipientId: escrow.recipientId,
        reference: releaseReference,
        // Deterministic key = hard backstop against a second release ever committing.
        idempotencyKey: `escrow-release-${escrow.id}`,
        isUserAccountTransfer: true,
        description: `Escrow release for ${escrow.escrowUprn}`,
        metadata: {
          escrowId: escrow.id,
          escrowUprn: escrow.escrowUprn,
          escrowType: "release",
        },
      },
      { transaction: t }
    );

    // 5. Atomically credit the seller wallet (balance = balance + amount).
    await creditWallet({
      walletId: sellerWallet.id,
      amount: releaseAmount,
      transaction: t,
    });

    // 6. Ledger record on the escrow itself.
    await EscrowTransaction.create(
      {
        escrowId: escrow.id,
        userId: escrow.recipientId,
        type: "RELEASE",
        amount: releaseAmount,
        currency: escrow.currency,
        balanceAfterTransaction: 0,
        outstandingBalanceAfterTransaction: 0,
        originalAmount: escrow.amount,
        status: "COMPLETED",
        transactionReference: releaseReference,
        metadata: {
          escrowUprn: escrow.escrowUprn,
          releaseTransactionId: releaseTransaction.id,
        },
      },
      { transaction: t }
    );

    // 7. Finalize the escrow in one write. RECEIVED is a logical milestone —
    //    we record buyerReceived/buyerReceivedAt but commit straight to RELEASED.
    await escrow.update(
      {
        buyerReceived: true,
        buyerReceivedAt: new Date(),
        status: "RELEASED",
        releaseTransactionId: releaseTransaction.id,
        currentBalance: 0,
      },
      { transaction: t }
    );

    // 8. Mark the linked quote Completed, if any.
    const quoteId = escrow.metadata && escrow.metadata.quoteid;
    if (quoteId) {
      const quote = await Quote.findByPk(quoteId, { transaction: t });
      if (quote) {
        quote.status = "Completed";
        await quote.save({ transaction: t });
      }
    }

    console.log(
      `[escrow-release] Escrow ${escrow.id} released; transaction ${releaseTransaction.id} credited to wallet ${sellerWallet.id}`
    );

    return escrow;
  });
};

module.exports = {
  confirmReceiptAndRelease,
};
