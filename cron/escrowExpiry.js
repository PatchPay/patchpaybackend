const cron = require("node-cron");
const { Op } = require("sequelize");

const sequelize = require("../config/database");
const Escrow = require("../models/Escrow");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const Quote = require("../models/Quote");
const User = require("../models/User");

const { sendEmail } = require("../services/emailService");

const handleEscrowExpiry = async () => {
  const transactionDb = await sequelize.transaction();

  try {
    // IMPORTANT:
    // Do not include "creator" here.
    // PostgreSQL does not allow FOR UPDATE on the nullable side
    // of a LEFT OUTER JOIN.
    //
    // We lock only the escrow rows first, then fetch the creator
    // separately below.
    const escrows = await Escrow.findAll({
      where: {
        status: {
          [Op.in]: ["CREATED", "PARTIALLY_FUNDED", "FUNDED"],
        },
        expiryDate: {
          [Op.lte]: new Date(),
        },
      },
      transaction: transactionDb,
      lock: transactionDb.LOCK.UPDATE,
    });

    for (const escrow of escrows) {
      const quote = escrow.metadata?.quote_id
        ? await Quote.findByPk(escrow.metadata.quote_id, {
            transaction: transactionDb,
          })
        : null;

      // No money remaining in escrow.
      if (Number(escrow.currentBalance) <= 0) {
        await escrow.update(
          {
            status: "REFUNDED",
          },
          {
            transaction: transactionDb,
          }
        );
      } else {
        // Lock the creator's wallet before modifying the balance.
        const wallet = await Wallet.findOne({
          where: {
            userId: escrow.creatorId,
            currency: escrow.currency,
          },
          transaction: transactionDb,
          lock: transactionDb.LOCK.UPDATE,
        });

        if (!wallet) {
          console.warn(
            `No wallet found for creator ${escrow.creatorId} ` +
              `while processing expired escrow ${escrow.escrowUprn}`
          );

          continue;
        }

        const refundAmount = Number(escrow.currentBalance);

        const refund = await Transaction.create(
          {
            type: "transfer",
            amount: refundAmount,
            total: refundAmount,
            currency: escrow.currency,
            status: "completed",
            recipientWallet: wallet.id,
            recipientId: escrow.creatorId,
            description: `Automatic refund for expired escrow ${escrow.escrowUprn}`,
            isUserAccountTransfer: true,
            paymentMethod: "wallet",
            paymentGateway: "Internal",
          },
          {
            transaction: transactionDb,
          }
        );

        await wallet.update(
          {
            balance: Number(wallet.balance) + refundAmount,
          },
          {
            transaction: transactionDb,
          }
        );

        await escrow.update(
          {
            status: "REFUNDED",
            refundTransactionId: refund.id,
            currentBalance: 0,
          },
          {
            transaction: transactionDb,
          }
        );
      }

      // Cancel the associated quote if it exists.
      if (quote) {
        quote.status = "Cancelled";

        quote.metadata = {
          ...quote.metadata,
          cancellationReason: "Escrow wallet expired",
        };

        await quote.save({
          transaction: transactionDb,
        });
      }

      // Fetch creator separately because the escrow query above
      // intentionally does not JOIN the users table.
      const creator = await User.findByPk(escrow.creatorId, {
        transaction: transactionDb,
      });

      if (creator?.email) {
        await sendEmail(
          creator.email,
          "Escrow Refund Notification",
          `Your escrow ${escrow.escrowUprn} has expired.`
        );
      }
    }

    await transactionDb.commit();

    console.log(
      `Escrow expiry check completed. Processed ${escrows.length} expired escrow(s).`
    );
  } catch (error) {
    await transactionDb.rollback();

    console.error("Error processing expired escrows:", error);
  }
};

const startEscrowExpiryCron = () =>
  cron.schedule("0 * * * *", handleEscrowExpiry);

module.exports = startEscrowExpiryCron;