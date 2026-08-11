const Escrow = require('../models/Escrow');
const Quote = require('../models/Quote');
const Payment = require('../models/Payment');
const User = require('../models/User');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { formatAmount } = require('../utils/accountUtils');
const {
  generateUPRN,
  generateEscrowTransferUPRN,
  transactionNeedsUPRN
} = require('../utils/paymentUtils');
const { ApiError } = require('../utils/ApiError');
const { uploadImageBuffer, destroyImage } = require('../services/upload.service');
const { confirmReceiptAndRelease } = require('../services/escrowRelease.service');

// Create a new escrow from a quote
const createEscrow = async (req, res) => {
  const transactionDb = await sequelize.transaction();

  try {
    const { quoteid } = req.body;

    // Find the quote
    const quote = await Quote.findByPk(quoteid, { transaction: transactionDb });
    if (!quote) {
      await transactionDb.rollback();
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Verify quote status is 'Accepted'
    if (quote.status !== 'Accepted') {
      await transactionDb.rollback();
      return res.status(400).json({
        success: false,
        message: 'Can only create escrow for accepted quotes'
      });
    }

    // Check if escrow already exists for this quote
    const existingEscrow = await Escrow.findOne({ where: sequelize.where(sequelize.json('metadata.quoteid'), String(quote.id)), transaction: transactionDb });

    if (existingEscrow) {
      await transactionDb.rollback();
      return res.status(400).json({
        success: false,
        message: 'Escrow already exists for this quote'
      });
    }

    // Generate escrow UPRN
    const escrowUprn = await generateUPRN(quote.user, 'escrow_release');

    // Set expiry date to 30 days from now
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    // Create the escrow
    const escrow = await Escrow.create({
      creatorId: quote.user,
      recipientId: quote.destinatary_user,
      amount: quote.total, // Use the quote's total amount
      currency: quote.currency,
      escrowUprn,
      conditions: `Escrow for Quote #${quote.quote_number}`,
      description: quote.product_description,
      expiryDate, // Add expiry date
      metadata: {
        quoteid: quote.id,
        quote_number: quote.quote_number,
        product_quantity: quote.product_quantity,
        delivery_type: quote.delivery_type,
        trade_type: quote.trade_type,
        delivery_code: quote.delivery_code,
        line_total: quote.line_total,
        delivery_charge: quote.delivery_charge,
        transaction_charges: quote.transaction_charges,
        subtotal: quote.subtotal,
        exchange_rate: quote.exchange_rate
      }
    }, { transaction: transactionDb });
    await transactionDb.commit();

    res.status(201).json({
      success: true,
      data: escrow
    });
  } catch (error) {
    await transactionDb.rollback();
    
    console.error('Error creating escrow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create escrow'
    });
  }
};

// Get all escrows for a user (either as creator or recipient)
const getEscrows = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, role } = req.query;

    let query = {};

    // Filter by role if specified
    if (role === 'creator') {
      query.creatorId = userId;
    } else if (role === 'recipient') {
      query.recipientId = userId;
    } else {
      query[Op.or] = [{ creatorId: userId }, { recipientId: userId }];
    }

    // Filter by status if specified
    if (status) {
      query.status = status;
    }

    const escrows = await Escrow.findAll({ where: query, include: [{ association: 'creator', attributes: ['firstName', 'surname', 'email'] }, { association: 'recipient', attributes: ['firstName', 'surname', 'email'] }], order: [['createdAt', 'DESC']] });

    // Fetch associated quotes for each escrow
    const escrowsWithQuotes = await Promise.all(escrows.map(async (escrow) => {
      if (escrow.metadata && escrow.metadata.quoteid) {
        const quote = await Quote.findByPk(escrow.metadata.quoteid, { attributes: ['quote_number', 'status', 'total', 'currency'] });
        return {
          ...escrow.toJSON(),
          quote: quote ? quote.toJSON() : null
        };
      }
      return escrow.toJSON();
    }));

    res.json({
      success: true,
      data: escrowsWithQuotes
    });
  } catch (error) {
    console.error('Error fetching escrows:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch escrows'
    });
  }
};


const getMyEscrows = async (req, res) => {
  try {

    const userId = req.user.id;

    console.log("req.user:", req.user);

    const escrows = await Escrow.findAll({ where: { [Op.or]: [
        { creatorId: userId },
        { recipientId: userId }
      ] }, include: [{ association: 'creator', attributes: ['firstName', 'surname', 'email', 'phoneNumber'] }, { association: 'recipient', attributes: ['firstName', 'surname', 'email', 'phoneNumber'] }], order: [['createdAt', 'DESC']] });


    res.status(200).json({
      success: true,
      data: escrows
    });


  } catch(error){

    console.error("Error getting user escrows:", error);

    res.status(500).json({
      success:false,
      message:"Failed to fetch escrows"
    });

  }
};

// Get a single escrow by ID
const getEscrowById = async (req, res) => {
  try {
    const escrow = await Escrow.findByPk(req.params.id, { include: [{ association: 'creator' }, { association: 'recipient' }, { association: 'fundingTransaction' }, { association: 'releaseTransaction' }, { association: 'refundTransaction' }] });

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow not found'
      });
    }

    // Fetch associated quote if it exists
    let quote = null;
    if (escrow.metadata && escrow.metadata.quoteid) {
      quote = await Quote.findByPk(escrow.metadata.quoteid, { attributes: ['quote_number', 'status', 'total', 'currency', 'product_description', 'delivery_type', 'trade_type'] });
    }

    res.json({
      success: true,
      data: {
        ...escrow.toJSON(),
        quote: quote ? quote.toJSON() : null
      }
    });
  } catch (error) {
    console.error('Error fetching escrow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch escrow'
    });
  }
};

// Seller marks the escrow as DELIVERED by uploading a delivery-proof image


const markEscrowDelivered = async (req, res) => {
  const escrowId = req.params.id;
  const userId = req.user.id;

  // ---------------------------------------------------------
  // 1. DEBUG REQUEST / UPLOADED FILE
  // ---------------------------------------------------------
  console.log("[escrow-deliver] REQUEST DEBUG:", {
    escrowId,
    userId,
    hasFile: !!req.file,
    fileField: req.file?.fieldname,
    fileName: req.file?.originalname,
    mimeType: req.file?.mimetype,
    fileSize: req.file?.size,
    hasBuffer: !!req.file?.buffer,
    bufferLength: req.file?.buffer?.length,
  });

  // ---------------------------------------------------------
  // 2. Validate uploaded file
  // ---------------------------------------------------------
  if (!req.file) {
    console.log("[escrow-deliver] ❌ NO FILE RECEIVED");

    return res.status(400).json({
      success: false,
      message: "No delivery-proof file was received",
    });
  }

  if (!req.file.buffer || req.file.buffer.length === 0) {
    console.log("[escrow-deliver] ❌ FILE BUFFER EMPTY");

    return res.status(400).json({
      success: false,
      message: "Delivery-proof file was received but contains no data",
    });
  }

  let uploaded = null;
  let transactionDb = null;

  try {
    // ---------------------------------------------------------
    // 3. Upload delivery proof to Cloudinary
    // ---------------------------------------------------------
    try {
      uploaded = await uploadImageBuffer(
        req.file.buffer,
        "escrow-delivery-proofs"
      );

      console.log("[escrow-deliver] Cloudinary upload successful:", {
        url: uploaded?.url,
        publicId: uploaded?.publicId,
      });
    } catch (error) {
      console.error("========================================");
      console.error("[escrow-deliver] CLOUDINARY UPLOAD ERROR");
      console.error("message:", error.message);
      console.error("name:", error.name);
      console.error("stack:", error.stack);
      console.error("response:", error.response?.data);
      console.error("========================================");

      return res.status(502).json({
        success: false,
        message: "Failed to upload delivery-proof image",
        error: error.message,
      });
    }

    // ---------------------------------------------------------
    // 4. Start database transaction
    // ---------------------------------------------------------
    transactionDb = await sequelize.transaction();

    // ---------------------------------------------------------
    // 5. Fetch escrow with row lock
    // ---------------------------------------------------------
    const escrow = await Escrow.findByPk(escrowId, {
      transaction: transactionDb,
      lock: transactionDb.LOCK.UPDATE,
    });

    if (!escrow) {
      await transactionDb.rollback();
      transactionDb = null;

      await destroyImage(uploaded.publicId);

      return res.status(404).json({
        success: false,
        message: "Escrow not found",
      });
    }

    // ---------------------------------------------------------
    // 6. Authorization check
    // Seller = recipientId
    // ---------------------------------------------------------
    const creatorMatch = String(userId) === String(escrow.creatorId);
    const recipientMatch = String(userId) === String(escrow.recipientId);

    console.log("[escrow-deliver] ROLE CHECK:", {
      escrowId: escrow.id,
      userId,
      creatorId: escrow.creatorId,
      recipientId: escrow.recipientId,
      creatorMatch,
      recipientMatch,
      status: escrow.status,
    });

    if (!recipientMatch) {
      await transactionDb.rollback();
      transactionDb = null;

      await destroyImage(uploaded.publicId);

      return res.status(403).json({
        success: false,
        message: "Only the seller can submit delivery proof",
      });
    }

    // ---------------------------------------------------------
    // 7. Log complete escrow state
    // ---------------------------------------------------------
    console.log("[escrow-deliver] ESCROW STATE:", {
      id: escrow.id,
      status: escrow.status,
      creatorId: escrow.creatorId,
      recipientId: escrow.recipientId,
      userId,
      deliveryProofUrl: escrow.deliveryProofUrl,
      deliveryProofPublicId: escrow.deliveryProofPublicId,
      sellerDeliveredAt: escrow.sellerDeliveredAt,
    });

    // ---------------------------------------------------------
    // 8. Check escrow state
    // ---------------------------------------------------------
    if (escrow.status !== "FUNDED") {
      await transactionDb.rollback();
      transactionDb = null;

      await destroyImage(uploaded.publicId);

      return res.status(400).json({
        success: false,
        message: `Delivery proof can only be submitted when escrow is FUNDED. Current status: ${escrow.status}`,
      });
    }

    // ---------------------------------------------------------
    // 9. Prevent duplicate delivery proof
    // ---------------------------------------------------------
    if (escrow.deliveryProofUrl || escrow.deliveryProofPublicId) {
      await transactionDb.rollback();
      transactionDb = null;

      await destroyImage(uploaded.publicId);

      return res.status(409).json({
        success: false,
        message: "Delivery proof has already been submitted",
      });
    }

    // ---------------------------------------------------------
    // 10. Mark escrow as delivered
    // ---------------------------------------------------------
    const deliveredAt = new Date();

    await escrow.update(
      {
        deliveryProofUrl: uploaded.url,
        deliveryProofPublicId: uploaded.publicId,
        sellerDeliveredAt: deliveredAt,
        status: "DELIVERED",
      },
      {
        transaction: transactionDb,
      }
    );

    // ---------------------------------------------------------
    // 11. Commit transaction
    // ---------------------------------------------------------
    await transactionDb.commit();
    transactionDb = null;

    console.log(
      `[escrow-deliver] Escrow ${escrow.id} marked DELIVERED by seller ${userId}`
    );

    return res.status(200).json({
      success: true,
      message: "Delivery proof submitted; escrow marked as delivered",
      data: {
        id: escrow.id,
        status: escrow.status,
        deliveryProofUrl: escrow.deliveryProofUrl,
        sellerDeliveredAt: escrow.sellerDeliveredAt,
      },
    });
  } catch (error) {
    // ---------------------------------------------------------
    // 12. Rollback database transaction if still active
    // ---------------------------------------------------------
    if (transactionDb) {
      try {
        await transactionDb.rollback();
      } catch (rollbackError) {
        console.error(
          "[escrow-deliver] Rollback failed:",
          rollbackError.message
        );
      }
    }

    // ---------------------------------------------------------
    // 13. Remove Cloudinary image if DB operation failed
    // ---------------------------------------------------------
    if (uploaded?.publicId) {
      try {
        await destroyImage(uploaded.publicId);
      } catch (cloudinaryError) {
        console.error(
          "[escrow-deliver] Failed to remove uploaded image:",
          cloudinaryError.message
        );
      }
    }

    console.error(
      "[escrow-deliver] Error marking escrow delivered:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to submit delivery proof",
    });
  }
};




// Buyer confirms receipt — this triggers the automatic, atomic fund release
const confirmEscrowReceipt = async (req, res) => {
  try {
    const escrow = await confirmReceiptAndRelease(req.params.id, req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Receipt confirmed; escrow funds released to the seller',
      data: escrow,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
      console.error('Error confirming escrow receipt:', error.message);
      return res.status(statusCode).json({
        success: false,
        message: 'Failed to confirm receipt and release escrow',
      });
    }

    return res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

// Release escrow funds.
// Hardened: delegates to the same atomic release service as confirm-receipt,
// which requires the escrow to be DELIVERED with valid proof and the caller to
// be the buyer. This prevents /release from paying out a merely-FUNDED escrow
// and bypassing the delivery/confirmation flow. Any client-supplied
// transactionId in the body is ignored — the release transaction is created
// server-side.
const releaseEscrow = async (req, res) => {
  try {
    const escrow = await confirmReceiptAndRelease(req.params.id, req.user.id);

    return res.json({
      success: true,
      message: 'Escrow funds released to the seller',
      data: escrow,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
      console.error('Error releasing escrow:', error.message);
      return res.status(statusCode).json({
        success: false,
        message: 'Failed to release escrow',
      });
    }

    return res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

// Refund escrow
const refundEscrow = async (req, res) => {
  try {
    const { transactionId } = req.body;
    const escrow = await Escrow.findByPk(req.params.id);

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow not found'
      });
    }

    if (escrow.status !== 'FUNDED') {
      return res.status(400).json({
        success: false,
        message: 'Escrow cannot be refunded in its current state'
      });
    }

    escrow.status = 'REFUNDED';
    escrow.refundTransactionId = transactionId;
    await escrow.save();

    res.json({
      success: true,
      data: escrow
    });
  } catch (error) {
    console.error('Error refunding escrow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refund escrow'
    });
  }
};

// Dispute an escrow
const disputeEscrow = async (req, res) => {
  try {
    const { reason } = req.body;
    const escrow = await Escrow.findByPk(req.params.id);

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow not found'
      });
    }

    if (escrow.status !== 'FUNDED' && escrow.status !== 'DELIVERED') {
      return res.status(400).json({
        success: false,
        message: 'Escrow cannot be disputed in its current state'
      });
    }

    escrow.status = 'DISPUTED';
    escrow.metadata = { ...escrow.metadata, disputeReason: reason };
    await escrow.save();

    res.json({
      success: true,
      data: escrow
    });
  } catch (error) {
    console.error('Error disputing escrow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dispute escrow'
    });
  }
};

// Cancel an escrow
const cancelEscrow = async (req, res) => {
  try {
    const escrow = await Escrow.findByPk(req.params.id);

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow not found'
      });
    }

    if (escrow.status !== 'CREATED') {
      return res.status(400).json({
        success: false,
        message: 'Escrow cannot be cancelled in its current state'
      });
    }

    escrow.status = 'CANCELLED';
    await escrow.save();

    res.json({
      success: true,
      data: escrow
    });
  } catch (error) {
    console.error('Error cancelling escrow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel escrow'
    });
  }
};

module.exports = {
  createEscrow,
  getEscrows,
  getEscrowById,
  getMyEscrows,
  markEscrowDelivered,
  confirmEscrowReceipt,
  releaseEscrow,
  refundEscrow,
  disputeEscrow,
  cancelEscrow
}; 
