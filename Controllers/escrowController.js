const Escrow = require('../models/Escrow');
const Quote = require('../models/Quote');
const Payment = require('../models/Payment');
const User = require('../models/User');
const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { formatAmount } = require('../utils/accountUtils');
const { 
  generateUPRN, 
  generateEscrowTransferUPRN,
  transactionNeedsUPRN
} = require('../utils/paymentUtils');
const { ApiError } = require('../utils/ApiError');

// Create a new escrow from a quote
const createEscrow = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { quote_id } = req.body;

    // Find the quote
    const quote = await Quote.findById(quote_id).session(session);
    if (!quote) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Verify quote status is 'Accepted'
    if (quote.status !== 'Accepted') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Can only create escrow for accepted quotes'
      });
    }

    // Check if escrow already exists for this quote
    const existingEscrow = await Escrow.findOne({ 
      metadata: { quote_id: quote._id }
    }).session(session);

    if (existingEscrow) {
      await session.abortTransaction();
      session.endSession();
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
    const escrow = new Escrow({
      creatorId: quote.user,
      recipientId: quote.destinatary_user,
      amount: quote.total, // Use the quote's total amount
      currency: quote.currency,
      escrowUprn,
      conditions: `Escrow for Quote #${quote.quote_number}`,
      description: quote.product_description,
      expiryDate, // Add expiry date
      metadata: {
        quote_id: quote._id,
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
    });

    await escrow.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: escrow
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
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
    const userId = req.user._id;
    const { status, role } = req.query;

    let query = {};

    // Filter by role if specified
    if (role === 'creator') {
      query.creatorId = userId;
    } else if (role === 'recipient') {
      query.recipientId = userId;
    } else {
      query.$or = [{ creatorId: userId }, { recipientId: userId }];
    }

    // Filter by status if specified
    if (status) {
      query.status = status;
    }

    const escrows = await Escrow.find(query)
      .populate('creatorId', 'firstName lastName email')
      .populate('recipientId', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Fetch associated quotes for each escrow
    const escrowsWithQuotes = await Promise.all(escrows.map(async (escrow) => {
      if (escrow.metadata && escrow.metadata.quote_id) {
        const quote = await Quote.findById(escrow.metadata.quote_id)
          .select('quote_number status total currency');
        return {
          ...escrow.toObject(),
          quote: quote ? quote.toObject() : null
        };
      }
      return escrow.toObject();
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

// Get a single escrow by ID
const getEscrowById = async (req, res) => {
  try {
    const escrow = await Escrow.findById(req.params.id)
      .populate('creatorId', 'firstName lastName email')
      .populate('recipientId', 'firstName lastName email')
      .populate('fundingTransactionId')
      .populate('releaseTransactionId')
      .populate('refundTransactionId');

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow not found'
      });
    }

    // Fetch associated quote if it exists
    let quote = null;
    if (escrow.metadata && escrow.metadata.quote_id) {
      quote = await Quote.findById(escrow.metadata.quote_id)
        .select('quote_number status total currency product_description delivery_type trade_type');
    }

    res.json({
      success: true,
      data: {
        ...escrow.toObject(),
        quote: quote ? quote.toObject() : null
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

// Fund an escrow
const fundEscrow = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { transactionId } = req.body;
    const escrow = await Escrow.findById(req.params.id).session(session);

    if (!escrow) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Escrow not found'
      });
    }

    if (escrow.status !== 'created') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Escrow cannot be funded in its current state'
      });
    }

    // Verify the transaction amount matches the escrow amount
    const transaction = await Transaction.findById(transactionId).session(session);
    if (!transaction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.amount !== escrow.amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Transaction amount does not match escrow amount'
      });
    }

    escrow.status = 'funded';
    escrow.fundingTransactionId = transactionId;
    await escrow.save({ session });

    // If this escrow is linked to a quote, update the quote status
    if (escrow.metadata && escrow.metadata.quote_id) {
      const quote = await Quote.findById(escrow.metadata.quote_id).session(session);
      if (quote) {
        quote.status = 'Funded';
        await quote.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      data: escrow
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error funding escrow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fund escrow'
    });
  }
};

// Release escrow funds
const releaseEscrow = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { transactionId } = req.body;
    const escrow = await Escrow.findById(req.params.id).session(session);

    if (!escrow) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Escrow not found'
      });
    }

    if (escrow.status !== 'funded') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Escrow cannot be released in its current state'
      });
    }

    // Verify the transaction
    const transaction = await Transaction.findById(transactionId).session(session);
    if (!transaction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.amount !== escrow.amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Transaction amount does not match escrow amount'
      });
    }

    escrow.status = 'released';
    escrow.releaseTransactionId = transactionId;
    await escrow.save({ session });

    // If this escrow is linked to a quote, update the quote status
    if (escrow.metadata && escrow.metadata.quote_id) {
      const quote = await Quote.findById(escrow.metadata.quote_id).session(session);
      if (quote) {
        quote.status = 'Completed';
        await quote.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      data: escrow
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error releasing escrow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to release escrow'
    });
  }
};

// Refund escrow
const refundEscrow = async (req, res) => {
  try {
    const { transactionId } = req.body;
    const escrow = await Escrow.findById(req.params.id);

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow not found'
      });
    }

    if (escrow.status !== 'funded') {
      return res.status(400).json({
        success: false,
        message: 'Escrow cannot be refunded in its current state'
      });
    }

    escrow.status = 'refunded';
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
    const escrow = await Escrow.findById(req.params.id);

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow not found'
      });
    }

    if (escrow.status !== 'funded') {
      return res.status(400).json({
        success: false,
        message: 'Escrow cannot be disputed in its current state'
      });
    }

    escrow.status = 'disputed';
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
    const escrow = await Escrow.findById(req.params.id);

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow not found'
      });
    }

    if (escrow.status !== 'created') {
      return res.status(400).json({
        success: false,
        message: 'Escrow cannot be cancelled in its current state'
      });
    }

    escrow.status = 'cancelled';
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
  fundEscrow,
  releaseEscrow,
  refundEscrow,
  disputeEscrow,
  cancelEscrow
}; 