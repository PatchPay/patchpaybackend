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
    const escrows = await Escrow.findAll({
      where: { status: { [Op.in]: ["CREATED", "PARTIALLY_FUNDED", "FUNDED"] }, expiryDate: { [Op.lte]: new Date() } },
      include: [{ association: "creator" }], transaction: transactionDb, lock: transactionDb.LOCK.UPDATE,
    });
    for (const escrow of escrows) {
      const quote = escrow.metadata?.quote_id ? await Quote.findByPk(escrow.metadata.quote_id, { transaction: transactionDb }) : null;
      if (Number(escrow.currentBalance) <= 0) {
        await escrow.update({ status: "REFUNDED" }, { transaction: transactionDb });
      } else {
        const wallet = await Wallet.findOne({ where: { userId: escrow.creatorId, currency: escrow.currency }, transaction: transactionDb, lock: transactionDb.LOCK.UPDATE });
        if (!wallet) continue;
        const refund = await Transaction.create({ type: "transfer", amount: escrow.currentBalance, total: escrow.currentBalance, currency: escrow.currency, status: "completed", recipientWallet: wallet.id, recipientId: escrow.creatorId, description: `Automatic refund for expired escrow ${escrow.escrowUprn}`, isUserAccountTransfer: true, paymentMethod: "wallet", paymentGateway: "Internal" }, { transaction: transactionDb });
        await wallet.update({ balance: Number(wallet.balance) + Number(escrow.currentBalance) }, { transaction: transactionDb });
        await escrow.update({ status: "REFUNDED", refundTransactionId: refund.id, currentBalance: 0 }, { transaction: transactionDb });
      }
      if (quote) {
        quote.status = "Cancelled";
        quote.metadata = { ...quote.metadata, cancellationReason: "Escrow wallet expired" };
        await quote.save({ transaction: transactionDb });
      }
      const creator = escrow.creator || await User.findByPk(escrow.creatorId, { transaction: transactionDb });
      if (creator?.email) await sendEmail(creator.email, "Escrow Refund Notification", `Your escrow ${escrow.escrowUprn} has expired.`);
    }
    await transactionDb.commit();
  } catch (error) {
    await transactionDb.rollback();
    console.error("Error processing expired escrows:", error);
  }
};

const startEscrowExpiryCron = () => cron.schedule("0 * * * *", handleEscrowExpiry);
module.exports = startEscrowExpiryCron;
