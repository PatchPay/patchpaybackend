const User = require('../models/User');
const Quote = require('../models/Quote');
const Invitation = require('../models/Invitation');
const QuoteHistory = require('../models/QuoteHistory');
const { calculateTransactionFee, isInternationalTransaction, isCrossContinentalTransaction } = require('../utils/transactionFeeUtils');
const crypto = require('crypto');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');

// Set up nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Send email function
const sendEmail = async (to, subject, text) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4a4a4a;">PatchPay Notification</h2>
          <p>${text}</p>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Search for a user by various criteria
const searchUser = async (req, res) => {
  try {
    const { query, searchType } = req.query;

    if (!query || !searchType) {
      return res.status(400).json({
        success: false,
        message: 'Query and searchType are required'
      });
    }

    // Simple direct query based on searchType with all required fields
    let user;
    const requiredFields = {
      firstName: 1,
      lastName: 1,
      email: 1,
      phoneNumber: 1,
      accountType: 1,
      currency: 1,
      country: 1,
      countryCode: 1,
      continent: 1,
      status_client: 1,
      uniqueId: 1,
      address: 1,
      state: 1
    };

    switch (searchType) {
      case 'email':
        user = await User.findOne({ email: query }).select(requiredFields);
        break;
      case 'phone':
        user = await User.findOne({ phoneNumber: query }).select(requiredFields);
        break;
      case 'id':
        user = await User.findOne({ uniqueId: query }).select(requiredFields);
        break;
      case 'name':
        user = await User.findOne({ 
          $or: [
            { firstName: query },
            { lastName: query }
          ]
        }).select(requiredFields);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid search type'
        });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Ensure the user has all required fields for exchange rate calculation
    if (!user.currency) user.currency = 'GBP';
    if (!user.countryCode) user.countryCode = 'GB';
    if (!user.continent) user.continent = 'Europe';

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error in searchUser:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching user'
    });
  }
};

// Create a new RFQ
const createRFQ = async (req, res) => {
  try {
    console.log('Received RFQ data:', req.body);
    const { 
      recipientId, 
      product_description, 
      product_quantity, 
      amount,
      delivery_code,
      delivery_type,
      trade_type,
      delivery_address,
      line_total,
      delivery_charge,
      transaction_charges,
      subtotal,
      total_amount
    } = req.body;

    // Find recipient
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Get the sender's details for currency
    const sender = await User.findById(req.user._id);
    if (!sender) {
      return res.status(404).json({
        success: false,
        message: 'Sender not found'
      });
    }

    // Generate unique quote number
    const quoteNumber = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    // Generate UPRN (Unique Property Reference Number)
    const uprn = crypto.randomBytes(6).toString('hex').toUpperCase();

    // Get currencies
    const senderCurrency = sender.currency || 'GBP';
    const recipientCurrency = recipient.currency || 'GBP';

    // Calculate exchange rate and total using the same logic as transfers
    const feeDetails = calculateTransactionFee(sender, recipient, Number(amount));
    
    // Calculate total based on exchange rate
    let exchangeRate = 1;

    // If currencies are different, apply the exchange rate
    if (isInternationalTransaction(sender.countryCode, recipient.countryCode)) {
      if (isCrossContinentalTransaction(sender.countryCode, recipient.countryCode)) {
        // Cross-continental rate
        exchangeRate = feeDetails.feePercentage / 100 + 1;
      } else {
        // Same continent but different countries
        exchangeRate = feeDetails.feePercentage / 100 + 1;
      }
    }

    // Create RFQ with all required fields
    const rfq = new Quote({
      quote_number: quoteNumber,
      type: 'RFQ',
      product_description,
      product_quantity,
      amount: Number(amount),
      currency: senderCurrency,
      total: total_amount,
      uprn,
      status: 'Pending',
      user: req.user._id,
      destinatary_user: recipientId,
      delivery_code: delivery_code || Math.floor(100000 + Math.random() * 900000),
      delivery_type,
      trade_type,
      delivery_address,
      line_total,
      delivery_charge,
      transaction_charges,
      subtotal,
      proof_delivery: new mongoose.Types.ObjectId(),
      coupon: [],
      exchange_rate: exchangeRate,
      responseNotificationDue: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours from now
      notificationSent: false
    });

    await rfq.save();

    // Create quote history entry
    const quoteHistory = new QuoteHistory({
      quote: rfq._id,
      user: recipientId,
      status: 'Pending',
      action: 'Created',
      notificationDue: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours for response
      notificationSent: false
    });

    await quoteHistory.save();

    // Create notification for sender
    const senderNotification = new Notification({
      recipientId: req.user._id,
      senderId: req.user._id,
      title: "RFQ Created",
      message: `You have created RFQ #${quoteNumber} for ${product_description}`,
      type: "success",
      category: "system",
      metadata: {
        quoteId: rfq._id,
        quoteNumber,
        amount: Number(amount),
        currency: senderCurrency,
        recipientName: `${recipient.firstName} ${recipient.lastName}`
      }
    });
    await senderNotification.save();

    // Create notification for recipient
    const recipientNotification = new Notification({
      recipientId: recipientId,
      senderId: req.user._id,
      title: "New RFQ Received",
      message: `You have received RFQ #${quoteNumber} from ${sender.firstName} ${sender.lastName}`,
      type: "info",
      category: "system",
      metadata: {
        quoteId: rfq._id,
        quoteNumber,
        amount: Number(amount),
        currency: senderCurrency,
        senderName: `${sender.firstName} ${sender.lastName}`
      }
    });
    await recipientNotification.save();

    res.status(201).json({
      success: true,
      data: rfq
    });
  } catch (error) {
    console.error('Error in createRFQ:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating RFQ'
    });
  }
};

// Send invitation to non-registered user
const sendInvitation = async (req, res) => {
  try {
    const { contact, type = 'email' } = req.body;

    if (!contact) {
      return res.status(400).json({
        success: false,
        message: 'Contact information is required'
      });
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days expiration

    // Create invitation
    const invitation = new Invitation({
      contact,
      type,
      token,
      expiresAt,
      status: 'pending'
    });

    await invitation.save();

    // Send invitation via email
    if (type === 'email') {
      try {
        await sendEmail(contact, 'Join PatchPay', `Click here to join: ${process.env.FRONTEND_URL}/register?token=${token}`);
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError);
        return res.status(500).json({
          success: false,
          message: 'Error sending invitation email'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Only email invitations are supported'
      });
    }

    res.json({
      success: true,
      message: 'Invitation sent successfully'
    });
  } catch (error) {
    console.error('Error in sendInvitation:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending invitation'
    });
  }
};

const getQuotes = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all quotes where the user is either the creator or recipient
    const quotes = await Quote.find({
      $or: [
        { user: userId },
        { destinatary_user: userId }
      ]
    })
    .populate('user', 'firstName lastName organization email phoneNumber uniqueId address')
    .populate('destinatary_user', 'firstName lastName organization email phoneNumber uniqueId address')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: quotes
    });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quotes'
    });
  }
};

// Cancel a quote
const cancelQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user._id;

    // Find the quote and populate user details
    const quote = await Quote.findById(quoteId)
      .populate('user', 'firstName lastName email')
      .populate('destinatary_user', 'firstName lastName email');

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Check if the user is the issuer of the quote
    if (quote.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the quote issuer can cancel the quote'
      });
    }

    // Check if the quote is in a cancellable state
    if (quote.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending quotes can be cancelled'
      });
    }

    // Update the quote status to cancelled
    quote.status = 'Cancelled';
    await quote.save();

    // Create quote history entry
    const quoteHistory = new QuoteHistory({
      quote: quote._id,
      user: userId,
      status: 'Cancelled',
      action: 'Cancelled by issuer'
    });
    await quoteHistory.save();

    // Create notification for issuer
    const issuerNotification = new Notification({
      recipientId: quote.user._id,
      senderId: userId,
      title: "RFQ Cancelled",
      message: `You have cancelled RFQ #${quote.quote_number}`,
      type: "info",
      category: "system",
      metadata: {
        quoteId: quote._id,
        quoteNumber: quote.quote_number
      }
    });
    await issuerNotification.save();

    // Create notification for recipient
    const recipientNotification = new Notification({
      recipientId: quote.destinatary_user._id,
      senderId: userId,
      title: "RFQ Cancelled",
      message: `RFQ #${quote.quote_number} has been cancelled by ${quote.user.firstName} ${quote.user.lastName}`,
      type: "warning",
      category: "system",
      metadata: {
        quoteId: quote._id,
        quoteNumber: quote.quote_number,
        senderName: `${quote.user.firstName} ${quote.user.lastName}`
      }
    });
    await recipientNotification.save();

    // Send email notification to the recipient
    try {
      await sendEmail(
        quote.destinatary_user.email,
        'Quote Cancelled',
        `Quote #${quote.quote_number} has been cancelled by the issuer.`
      );
    } catch (emailError) {
      console.error('Error sending cancellation email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Quote cancelled successfully',
      data: quote
    });
  } catch (error) {
    console.error('Error in cancelQuote:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling quote'
    });
  }
};

// Accept a quote
const acceptQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user._id;

    // Find the quote and populate user details
    const quote = await Quote.findById(quoteId)
      .populate('user', 'firstName lastName email')
      .populate('destinatary_user', 'firstName lastName email');

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Check if the user is the recipient of the quote
    if (quote.destinatary_user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the quote recipient can accept the quote'
      });
    }

    // Check if the quote is in an acceptable state
    if (quote.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending quotes can be accepted'
      });
    }

    // Update the quote status to accepted
    quote.status = 'Accepted';
    await quote.save();

    // Create quote history entry
    const quoteHistory = new QuoteHistory({
      quote: quote._id,
      user: userId,
      status: 'Accepted',
      action: 'Accepted by recipient',
      deletionDue: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    });
    await quoteHistory.save();

    // Create notification for issuer
    const issuerNotification = new Notification({
      recipientId: quote.user._id,
      senderId: userId,
      title: "RFQ Accepted",
      message: `Your RFQ #${quote.quote_number} has been accepted by ${quote.destinatary_user.firstName} ${quote.destinatary_user.lastName}`,
      type: "success",
      category: "system",
      metadata: {
        quoteId: quote._id,
        quoteNumber: quote.quote_number,
        recipientName: `${quote.destinatary_user.firstName} ${quote.destinatary_user.lastName}`
      }
    });
    await issuerNotification.save();

    // Create notification for recipient
    const recipientNotification = new Notification({
      recipientId: quote.destinatary_user._id,
      senderId: userId,
      title: "RFQ Accepted",
      message: `You have accepted RFQ #${quote.quote_number}`,
      type: "success",
      category: "system",
      metadata: {
        quoteId: quote._id,
        quoteNumber: quote.quote_number
      }
    });
    await recipientNotification.save();

    // Send email notification to the issuer
    try {
      const issuer = await User.findById(quote.user);
      await sendEmail(
        issuer.email,
        'Quote Accepted',
        `Quote #${quote.quote_number} has been accepted by the recipient.`
      );
    } catch (emailError) {
      console.error('Error sending acceptance email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Quote accepted successfully',
      data: quote
    });
  } catch (error) {
    console.error('Error in acceptQuote:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error accepting quote'
    });
  }
};

// Reject a quote
const rejectQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user._id;
    const { reason } = req.body;

    // Find the quote and populate user details
    const quote = await Quote.findById(quoteId)
      .populate('user', 'firstName lastName email')
      .populate('destinatary_user', 'firstName lastName email');

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Check if the user is the recipient of the quote
    if (quote.destinatary_user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the quote recipient can reject the quote'
      });
    }

    // Check if the quote is in a rejectable state
    if (quote.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending quotes can be rejected'
      });
    }

    // Update the quote status to rejected
    quote.status = 'Rejected';
    await quote.save();

    // Create quote history entry
    const quoteHistory = new QuoteHistory({
      quote: quote._id,
      user: userId,
      status: 'Rejected',
      action: `Rejected by recipient${reason ? ': ' + reason : ''}`,
      deletionDue: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    });
    await quoteHistory.save();

    // Create notification for issuer
    const issuerNotification = new Notification({
      recipientId: quote.user._id,
      senderId: userId,
      title: "RFQ Rejected",
      message: `Your RFQ #${quote.quote_number} has been rejected by ${quote.destinatary_user.firstName} ${quote.destinatary_user.lastName}${reason ? '. Reason: ' + reason : ''}`,
      type: "error",
      category: "system",
      metadata: {
        quoteId: quote._id,
        quoteNumber: quote.quote_number,
        recipientName: `${quote.destinatary_user.firstName} ${quote.destinatary_user.lastName}`,
        reason
      }
    });
    await issuerNotification.save();

    // Create notification for recipient
    const recipientNotification = new Notification({
      recipientId: quote.destinatary_user._id,
      senderId: userId,
      title: "RFQ Rejected",
      message: `You have rejected RFQ #${quote.quote_number}${reason ? '. Reason: ' + reason : ''}`,
      type: "info",
      category: "system",
      metadata: {
        quoteId: quote._id,
        quoteNumber: quote.quote_number,
        reason
      }
    });
    await recipientNotification.save();

    // Send email notification to the issuer
    try {
      const issuer = await User.findById(quote.user);
      await sendEmail(
        issuer.email,
        'Quote Rejected',
        `Quote #${quote.quote_number} has been rejected by the recipient${reason ? '. Reason: ' + reason : '.'}`
      );
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Quote rejected successfully',
      data: quote
    });
  } catch (error) {
    console.error('Error in rejectQuote:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error rejecting quote'
    });
  }
};

// Check and send notifications for pending quotes
const checkQuoteNotifications = async () => {
  try {
    const now = new Date();
    
    // Find quotes that need response notification (72 hours)
    const pendingQuotes = await Quote.find({
      status: 'Pending',
      responseNotificationDue: { $lte: now },
      notificationSent: false
    }).populate('user destinatary_user');

    for (const quote of pendingQuotes) {
      try {
        // Create notification for recipient about pending response
        const reminderNotification = new Notification({
          recipientId: quote.destinatary_user._id,
          senderId: quote.user._id,
          title: "RFQ Response Required",
          message: `RFQ #${quote.quote_number} requires your response. Please respond within 72 hours.`,
          type: "warning",
          category: "system",
          metadata: {
            quoteId: quote._id,
            quoteNumber: quote.quote_number,
            senderName: `${quote.user.firstName} ${quote.user.lastName}`
          }
        });
        await reminderNotification.save();
        
        quote.notificationSent = true;
        await quote.save();
      } catch (error) {
        console.error(`Error sending notification for quote ${quote.quote_number}:`, error);
      }
    }

    // Find quotes that are about to be deleted (13 days after response)
    const quotesToDelete = await Quote.find({
      status: { $in: ['Accepted', 'Rejected'] },
      updatedAt: {
        $lte: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000),
        $gt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      },
      deletionNotificationSent: { $ne: true }
    }).populate('user destinatary_user');

    for (const quote of quotesToDelete) {
      try {
        // Create deletion notification for issuer
        const issuerDeletionNotification = new Notification({
          recipientId: quote.user._id,
          senderId: quote.user._id,
          title: "RFQ Deletion Notice",
          message: `RFQ #${quote.quote_number} will be deleted in 24 hours.`,
          type: "warning",
          category: "system",
          metadata: {
            quoteId: quote._id,
            quoteNumber: quote.quote_number
          }
        });
        await issuerDeletionNotification.save();

        // Create deletion notification for recipient
        const recipientDeletionNotification = new Notification({
          recipientId: quote.destinatary_user._id,
          senderId: quote.user._id,
          title: "RFQ Deletion Notice",
          message: `RFQ #${quote.quote_number} will be deleted in 24 hours.`,
          type: "warning",
          category: "system",
          metadata: {
            quoteId: quote._id,
            quoteNumber: quote.quote_number
          }
        });
        await recipientDeletionNotification.save();

        quote.deletionNotificationSent = true;
        await quote.save();
      } catch (error) {
        console.error(`Error sending deletion notification for quote ${quote.quote_number}:`, error);
      }
    }

    // Delete quotes that are 14 days old after response
    const deleteQuotes = await Quote.find({
      status: { $in: ['Accepted', 'Rejected'] },
      updatedAt: { $lte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) }
    });

    for (const quote of deleteQuotes) {
      await Quote.findByIdAndDelete(quote._id);
      await QuoteHistory.findOneAndUpdate(
        { quote: quote._id },
        { 
          status: 'Deleted',
          action: 'Automatic Deletion',
          deletedAt: now
        }
      );
    }
  } catch (error) {
    console.error('Error in checkQuoteNotifications:', error);
  }
};

// Get a single quote by ID
const getQuoteById = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user._id;

    // Find the quote and populate user details
    const quote = await Quote.findById(quoteId)
      .populate('user', 'firstName lastName organization email phoneNumber uniqueId address')
      .populate('destinatary_user', 'firstName lastName organization email phoneNumber uniqueId address');

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Check if the user has permission to view this quote
    if (quote.user._id.toString() !== userId.toString() && 
        quote.destinatary_user._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this quote'
      });
    }

    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quote'
    });
  }
};

module.exports = {
  searchUser,
  createRFQ,
  sendInvitation,
  getQuotes,
  cancelQuote,
  acceptQuote,
  rejectQuote,
  checkQuoteNotifications,
  getQuoteById
}; 