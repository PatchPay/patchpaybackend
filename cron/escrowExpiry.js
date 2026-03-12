const cron = require('node-cron');
const Escrow = require('../models/Escrow');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const Quote = require('../models/Quote');
const mongoose = require('mongoose');
const { sendEmail } = require('../services/emailService');

const handleEscrowExpiry = async () => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Find expired escrows that haven't been refunded yet
      const expiredEscrows = await Escrow.find({
        status: { $in: ['CREATED', 'PARTIALLY_FUNDED', 'FUNDED'] },
        expiryDate: { $lte: new Date() }
      }).populate('creatorId').session(session);

      for (const escrow of expiredEscrows) {
        if (escrow.currentBalance <= 0) {
          // Just mark as REFUNDED if no balance to refund
          escrow.status = 'REFUNDED';
          await escrow.save({ session });

          // Cancel associated quote if it exists
          if (escrow.metadata?.quote_id) {
            const quote = await Quote.findById(escrow.metadata.quote_id).session(session);
            if (quote) {
              quote.status = 'Cancelled';
              quote.metadata = {
                ...quote.metadata,
                cancellationReason: 'Escrow wallet expired'
              };
              await quote.save({ session });

              // Send notification about quote cancellation
              try {
                await sendEmail(
                  quote.user.email,
                  'Quote Cancelled - Escrow Expired',
                  `Your quote #${quote.quote_number} has been cancelled because the associated escrow wallet has expired.`
                );
              } catch (emailError) {
                console.error('Error sending quote cancellation email:', emailError);
              }
            }
          }
          continue;
        }

        // Get creator's wallet
        const creatorWallet = await Wallet.findOne({
          userId: escrow.creatorId._id,
          currency: escrow.currency
        }).session(session);

        if (!creatorWallet) {
          console.error(`No wallet found for user ${escrow.creatorId._id} in currency ${escrow.currency}`);
          continue;
        }

        // Create refund transaction
        const refundTransaction = new Transaction({
          type: 'transfer',
          amount: escrow.currentBalance,
          currency: escrow.currency,
          status: 'completed',
          senderWallet: null,
          senderId: null,
          recipientWallet: creatorWallet._id,
          recipientId: escrow.creatorId._id,
          description: `Automatic refund for expired escrow ${escrow.escrowUprn}`,
          isUserAccountTransfer: true,
          paymentMethod: 'wallet',
          paymentGateway: 'Internal'
        });

        await refundTransaction.save({ session });

        // Update wallet balance
        creatorWallet.balance += escrow.currentBalance;
        await creatorWallet.save({ session });

        // Update escrow status and add refund transaction reference
        escrow.status = 'REFUNDED';
        escrow.refundTransactionId = refundTransaction._id;
        escrow.currentBalance = 0;
        await escrow.save({ session });

        // Cancel associated quote if it exists
        if (escrow.metadata?.quote_id) {
          const quote = await Quote.findById(escrow.metadata.quote_id).session(session);
          if (quote) {
            quote.status = 'Cancelled';
            quote.metadata = {
              ...quote.metadata,
              cancellationReason: 'Escrow wallet expired'
            };
            await quote.save({ session });

            // Send notification about quote cancellation
            try {
              await sendEmail(
                quote.user.email,
                'Quote Cancelled - Escrow Expired',
                `Your quote #${quote.quote_number} has been cancelled because the associated escrow wallet has expired. The funds (${escrow.currency} ${escrow.currentBalance}) have been refunded to your wallet.`
              );
            } catch (emailError) {
              console.error('Error sending quote cancellation email:', emailError);
            }
          }
        }

        // Send notification email about the refund
        try {
          await sendEmail(
            escrow.creatorId.email,
            'Escrow Refund Notification',
            `Your escrow ${escrow.escrowUprn} has expired and ${escrow.currency} ${escrow.amount} has been refunded to your wallet.`
          );
        } catch (emailError) {
          console.error('Error sending refund notification email:', emailError);
          // Continue even if email fails
        }
      }
    });
  } catch (error) {
    console.error('Error processing expired escrows:', error);
  } finally {
    await session.endSession();
  }
};

// Run every hour
const startEscrowExpiryCron = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('Running escrow expiry check...');
    await handleEscrowExpiry();
    console.log('Escrow expiry check completed');
  });
};

module.exports = startEscrowExpiryCron; 