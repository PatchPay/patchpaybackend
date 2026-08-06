const User = require("../models/User");
const Quote = require("../models/Quote");
const Invitation = require("../models/Invitation");
const QuoteHistory = require("../models/QuoteHistory");
const {
  calculateTransactionFee,
  isInternationalTransaction,
  isCrossContinentalTransaction,
} = require("../utils/transactionFeeUtils");
const crypto = require("crypto");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const nodemailer = require("nodemailer");
const Notification = require("../models/Notification");

const runAfterResponse = (label, task) => {
  setImmediate(async () => {
    try {
      console.log(`STEP: background ${label} start`);
      await task();
      console.log(`STEP: background ${label} completed`);
    } catch (error) {
      console.error(`STEP: background ${label} failed`, error);
    }
  });
};

// Set up nodemailer transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, // Gmail App Password
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
});


transporter.verify((err, success) => {
  if (err) {
    console.error("❌ SMTP Verify Error:", err);
  } else {
    console.log("✅ SMTP Server Ready");
  }
});

// Send email function
const sendEmail = async (to, subject, text) => {
  try {
    console.log("STEP: sendEmail start", { to, subject });
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4a4a4a;">PatchPay Notification</h2>
          <p>${text}</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("STEP: sendEmail completed", info.response);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
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
        message: "Query and searchType are required",
      });
    }

    // Simple direct query based on searchType with all required fields
    let user;
  const requiredFields = [
  "id",
  "firstName",
  "surname",
  "email",
  "phoneNumber",
  "accountType",
  "country",
  "countryCode",

];

    switch (searchType) {
      case "email":
        user = await User.findOne({ where: { email: query }, attributes: requiredFields });
        break;
      case "phone":
        user = await User.findOne({ where: { phoneNumber: query }, attributes: requiredFields });
        break;
   
      case "name":
        user = await User.findOne({ where: { [Op.or]: [{ firstName: query }, { surname: query }] }, attributes: requiredFields });
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid search type",
        });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Ensure the user has all required fields for exchange rate calculation
    if (!user.currency) user.currency = "GBP";
    if (!user.countryCode) user.countryCode = "GB";
    if (!user.continent) user.continent = "Europe";

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error in searchUser:", error);
    res.status(500).json({
      success: false,
      message: "Error searching user",
    });
  }
};

const createRFQ = async (req, res) => {
  try {
    console.log("Received RFQ data:", req.body);

    const {
      recipientId,
      product_description,
      product_quantity,
      amount,
      currency,
      delivery_code,
      delivery_type,
      trade_type,
      delivery_address,
      arrival_date,
      arrival_time,
      delivery_charge,
      transaction_charges,
      subtotal,
    } = req.body;

    // =========================
    // Validate users first
    // =========================
    const recipient = await User.findByPk(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: "Recipient not found",
      });
    }

    if (!arrival_date || !arrival_time) {
      return res.status(400).json({
        success: false,
        message: "Arrival date and arrival time are required",
      });
    }

    const sender = await User.findByPk(req.user.id);
    if (!sender) {
      return res.status(404).json({
        success: false,
        message: "Sender not found",
      });
    }

    // console.log("Sender User:", sender);
    // console.log("Recipient User:", recipient);

    // console.log("Sender surname:", sender?.surname);
    // console.log("Recipient surname:", recipient?.surname);

    // =========================
    // Currency handling
    // =========================
    const senderCurrency = sender.currency || "GBP";
    const selectedCurrency = currency || senderCurrency;

    const allowedCurrencies = ["NGN", "USD", "GBP"];

    if (!allowedCurrencies.includes(selectedCurrency)) {
      return res.status(400).json({
        success: false,
        message: "Invalid currency selected",
      });
    }

    // =========================
    // Financial calculations
    // =========================
    const numericAmount = Number(amount);
    const numericDelivery = Number(delivery_charge || 0);
    const numericTransaction = Number(transaction_charges || 0);

    const lineTotal = numericAmount;
    const total = numericAmount + numericDelivery + numericTransaction;

    // Fee calculation (kept your existing logic)
    const feeDetails = calculateTransactionFee(
      sender,
      recipient,
      numericAmount,
    );

    let exchangeRate = 1;

    // basic fallback FX logic (safe version)
    if (senderCurrency !== selectedCurrency) {
      exchangeRate = feeDetails.feePercentage / 100 + 1;
    }

    // optional: override for international logic if needed
    if (isInternationalTransaction(sender.countryCode, recipient.countryCode)) {
      exchangeRate = feeDetails.feePercentage / 100 + 1;
    }

    // =========================
    // Generate identifiers
    // =========================
    const quoteNumber = crypto.randomBytes(4).toString("hex").toUpperCase();
    const uprn = crypto.randomBytes(6).toString("hex").toUpperCase();

    // =========================
    // Create RFQ
    // =========================
  const rfq = await Quote.create({
  quote_number: quoteNumber,
  type: "RFQ",
  product_description,
  product_quantity,
  amount: numericAmount,
  currency: selectedCurrency,
  total,
  uprn,
  status: "Pending",

  user_data: {
    id: sender.id,
    firstName: sender.firstName,
    surname: sender.surname,
    phoneNumber: sender.phoneNumber,
  },

  destinatary_user: {
    id: recipient.id,
    firstName: recipient.firstName,
    surname: recipient.surname,
    phoneNumber: recipient.phoneNumber,
  },

  delivery_code:
    delivery_code || Math.floor(100000 + Math.random() * 900000),
  delivery_type,
  trade_type,
  delivery_address,
  arrival_date,
  arrival_time,
  line_total: numericAmount,
  delivery_charge: numericDelivery,
  transaction_charges: numericTransaction,
  subtotal: subtotal || total,
 proof_delivery: Math.floor(Date.now() / 1000),
  coupon: [],
  exchange_rate: exchangeRate,
  responseNotificationDue: new Date(Date.now() + 72 * 60 * 60 * 1000),
  notificationSent: false,
});



    // =========================
    // Quote history
    // =========================
   await QuoteHistory.create({
      quote: rfq.id,
      user_data: {
        id: recipient.id,
        firstName: recipient.firstName,
        surname: recipient.surname,
        phoneNumber: recipient.phoneNumber,
      },
      status: "Pending",
      action: "Created",
      notificationDue: new Date(Date.now() + 72 * 60 * 60 * 1000),
      notificationSent: false,
    })

    // =========================
    // Notifications
    // =========================
    await Notification.create({
      recipientId: sender.id,
      senderId: sender.id,
      title: "RFQ Created",
      message: `You have created RFQ #${quoteNumber} for ${product_description}`,
      type: "success",
      category: "system",
      metadata: {
        quoteId: rfq.id,
        quoteNumber,
        amount: numericAmount,
        currency: selectedCurrency,
        recipientName: `${recipient.firstName} ${recipient.surname}`,
      },
    })

    await Notification.create({
      recipientId: recipientId,
      senderId: sender.id,
      title: "New RFQ Received",
      message: `You have received RFQ #${quoteNumber} from ${sender.firstName} ${sender.surname}`,
      type: "info",
      category: "system",
      metadata: {
        quoteId: rfq.id,
        quoteNumber,
        amount: numericAmount,
        currency: selectedCurrency,
        senderName: `${sender.firstName} ${sender.surname}`,
      },
    })

    // =========================
    // Response
    // =========================
    return res.status(201).json({
      success: true,
      data: rfq,
    });
  } catch (error) {
    console.error("Error in createRFQ:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error creating RFQ",
    });
  }
};
// Send invitation to non-registered user
const sendInvitation = async (req, res) => {
  try {
    const { contact, type = "email" } = req.body;

    if (!contact) {
      return res.status(400).json({
        success: false,
        message: "Contact information is required",
      });
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days expiration

    // Create invitation
    const invitation = new Invitation({
      contact,
      type,
      token,
      expiresAt,
      status: "pending",
    });

    await invitation.save();

    // Send invitation via email
    if (type === "email") {
      try {
        await sendEmail(
          contact,
          "Join PatchPay",
          `Click here to join: ${process.env.FRONTEND_URL}/register?token=${token}`,
        );
      } catch (emailError) {
        console.error("Error sending invitation email:", emailError);
        return res.status(500).json({
          success: false,
          message: "Error sending invitation email",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Only email invitations are supported",
      });
    }

    res.json({
      success: true,
      message: "Invitation sent successfully",
    });
  } catch (error) {
    console.error("Error in sendInvitation:", error);
    res.status(500).json({
      success: false,
      message: "Error sending invitation",
    });
  }
};

const getQuotes = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log("Current User ID:", userId);

    const quotes = await Quote.findAll({
      where: { [Op.or]: [sequelize.where(sequelize.json("user_data.id"), userId), sequelize.where(sequelize.json("destinatary_user.id"), userId)] },
      order: [["createdAt", "DESC"]],
    });

    console.log("Quotes Found:", quotes.length);

    if (quotes.length > 0) {
      console.log("First Quote:", JSON.stringify(quotes[0], null, 2));
    }

    return res.status(200).json({
      success: true,
      data: quotes,
    });
  } catch (error) {
    console.error("Error fetching quotes:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch quotes",
    });
  }
};

// Cancel a quote
const cancelQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user.id;

    console.log("STEP: before quote lookup cancelQuote", { quoteId });
    const quote = await Quote.findByPk(quoteId);
    console.log("STEP: after quote lookup cancelQuote", {
      quoteFound: !!quote,
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "Quote not found",
      });
    }

    // Check if the user is the issuer of the quote
    if (quote.user.id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the quote issuer can cancel the quote",
      });
    }

    // Check if the quote is in a cancellable state
    if (quote.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending quotes can be cancelled",
      });
    }

    // Update the quote status to cancelled
    quote.status = "Cancelled";
    console.log("STEP: before quote.save cancelQuote", {
      quoteId: quote.id,
      status: quote.status,
    });
    await quote.save();
    console.log("STEP: after quote.save cancelQuote", { quoteId: quote.id });

    runAfterResponse("cancelQuote side effects", async () => {
      // Create quote history entry
      const quoteHistory = new QuoteHistory({
        quote: quote.id,
        user: userId,
        status: "Cancelled",
        action: "Cancelled by issuer",
      });
      console.log("STEP: before quoteHistory.save cancelQuote", {
        quoteId: quote.id,
      });
      await quoteHistory.save();
      console.log("STEP: after quoteHistory.save cancelQuote", {
        quoteHistoryId: quoteHistory.id,
      });

      // Create notification for issuer
      const issuerNotification = new Notification({
        recipientId: quote.user.id,
        senderId: userId,
        title: "RFQ Cancelled",
        message: `You have cancelled RFQ #${quote.quote_number}`,
        type: "info",
        category: "system",
        metadata: {
          quoteId: quote.id,
          quoteNumber: quote.quote_number,
        },
      });
      console.log("STEP: before issuerNotification.save cancelQuote", {
        quoteId: quote.id,
      });
      await issuerNotification.save();
      console.log("STEP: after issuerNotification.save cancelQuote", {
        notificationId: issuerNotification.id,
      });

      // Create notification for recipient
      const recipientNotification = new Notification({
        recipientId: quote.destinatary_user.id,
        senderId: userId,
        title: "RFQ Cancelled",
        message: `RFQ #${quote.quote_number} has been cancelled by ${quote.user.firstName} ${quote.user.surname}`,
        type: "warning",
        category: "system",
        metadata: {
          quoteId: quote.id,
          quoteNumber: quote.quote_number,
          senderName: `${quote.user.firstName} ${quote.user.surname}`,
        },
      });
      console.log("STEP: before recipientNotification.save cancelQuote", {
        quoteId: quote.id,
      });
      await recipientNotification.save();
      console.log("STEP: after recipientNotification.save cancelQuote", {
        notificationId: recipientNotification.id,
      });

      // Send email notification to the recipient without blocking the response
      console.log("STEP: sending cancellation email in background", {
        quoteId: quote.id,
      });
      sendEmail(
        quote.destinatary_user.email,
        "Quote Cancelled",
        `Quote #${quote.quote_number} has been cancelled by the issuer.`,
      )
        .then((info) => {
          console.log("STEP: cancellation email sent", {
            quoteId: quote.id,
            response: info.response,
          });
        })
        .catch((emailError) => {
          console.error("Error sending cancellation email:", emailError);
        });
    });

    const responseQuote = quote.toObject ? quote.toObject() : quote;

    return res.status(200).json({
      success: true,
      message: "Quote cancelled successfully",
      data: responseQuote,
    });
  } catch (error) {
    console.error("Error in cancelQuote:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error cancelling quote",
    });
  }
};

// Accept a quote
const acceptQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user.id;

    console.log("STEP: before quote lookup acceptQuote", { quoteId });
    const quote = await Quote.findByPk(quoteId);
    console.log("STEP: after quote lookup acceptQuote", {
      quoteFound: !!quote,
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "Quote not found",
      });
    }

    // ✅ ADD LOGS HERE
    console.log("Logged in user:", userId.toString());
    console.log("Quote recipient:", quote.destinatary_user.id.toString());
    console.log("Quote creator:", quote.user.id.toString());

    // Check if the user is the recipient of the quote
    if (quote.destinatary_user.id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the quote recipient can accept the quote",
      });
    }

    // Check if the quote is in an acceptable state
    if (quote.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending quotes can be accepted",
      });
    }

    // Update the quote status to accepted
    quote.status = "Accepted";
    console.log("STEP: before quote.save acceptQuote", {
      quoteId: quote.id,
      status: quote.status,
    });
    await quote.save();
    console.log("STEP: after quote.save acceptQuote", { quoteId: quote.id });

    runAfterResponse("acceptQuote side effects", async () => {
      // Create quote history entry
      const quoteHistory = new QuoteHistory({
        quote: quote.id,
        user: userId,
        status: "Accepted",
        action: "Accepted by recipient",
        deletionDue: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });
      console.log("STEP: before quoteHistory.save acceptQuote", {
        quoteId: quote.id,
      });
      await quoteHistory.save();
      console.log("STEP: after quoteHistory.save acceptQuote", {
        quoteHistoryId: quoteHistory.id,
      });

      // Create notification for issuer
      const issuerNotification = new Notification({
        recipientId: quote.user.id,
        senderId: userId,
        title: "RFQ Accepted",
        message: `Your RFQ #${quote.quote_number} has been accepted by ${quote.destinatary_user.firstName} ${quote.destinatary_user.surname}`,
        type: "success",
        category: "system",
        metadata: {
          quoteId: quote.id,
          quoteNumber: quote.quote_number,
          recipientName: `${quote.destinatary_user.firstName} ${quote.destinatary_user.surname}`,
        },
      });
      console.log("STEP: before issuerNotification.save acceptQuote", {
        quoteId: quote.id,
      });
      await issuerNotification.save();
      console.log("STEP: after issuerNotification.save acceptQuote", {
        notificationId: issuerNotification.id,
      });

      // Create notification for recipient
      const recipientNotification = new Notification({
        recipientId: quote.destinatary_user.id,
        senderId: userId,
        title: "RFQ Accepted",
        message: `You have accepted RFQ #${quote.quote_number}`,
        type: "success",
        category: "system",
        metadata: {
          quoteId: quote.id,
          quoteNumber: quote.quote_number,
        },
      });
      console.log("STEP: before recipientNotification.save acceptQuote", {
        quoteId: quote.id,
      });
      await recipientNotification.save();
      console.log("STEP: after recipientNotification.save acceptQuote", {
        notificationId: recipientNotification.id,
      });

      // Send email notification to the issuer without blocking the response
      console.log("STEP: dispatch acceptance email in background", {
        quoteId: quote.id,
      });
      User.findByPk(quote.user)
        .then((issuer) => {
          if (!issuer?.email) {
            console.error("Acceptance email skipped: issuer email missing", {
              quoteId: quote.id,
            });
            return;
          }
          return sendEmail(
            issuer.email,
            "Quote Accepted",
            `Quote #${quote.quote_number} has been accepted by the recipient.`,
          );
        })
        .then((info) => {
          if (info) {
            console.log("STEP: acceptance email sent", {
              quoteId: quote.id,
              response: info.response,
            });
          }
        })
        .catch((emailError) => {
          console.error("Error sending acceptance email:", emailError);
        });
    });

    const responseQuote = quote.toObject ? quote.toObject() : quote;

    return res.status(200).json({
      success: true,
      message: "Quote accepted successfully",
      data: {
        quote: responseQuote,
      },
    });
  } catch (error) {
    console.error("Error in acceptQuote:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error accepting quote",
    });
  }
};

// Reject a quote
const rejectQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    console.log("STEP: before quote lookup rejectQuote", { quoteId });
    const quote = await Quote.findByPk(quoteId);
    console.log("STEP: after quote lookup rejectQuote", {
      quoteFound: !!quote,
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "Quote not found",
      });
    }

    // Check if the user is the recipient of the quote
    if (quote.destinatary_user.id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the quote recipient can reject the quote",
      });
    }

    // Check if the quote is in a rejectable state
    if (quote.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending quotes can be rejected",
      });
    }

    // Update the quote status to rejected
    quote.status = "Rejected";
    console.log("STEP: before quote.save rejectQuote", {
      quoteId: quote.id,
      status: quote.status,
    });
    await quote.save();
    console.log("STEP: after quote.save rejectQuote", { quoteId: quote.id });

    runAfterResponse("rejectQuote side effects", async () => {
      // Create quote history entry
      const quoteHistory = new QuoteHistory({
        quote: quote.id,
        user: userId,
        status: "Rejected",
        action: `Rejected by recipient${reason ? ": " + reason : ""}`,
        deletionDue: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });
      console.log("STEP: before quoteHistory.save rejectQuote", {
        quoteId: quote.id,
      });
      await quoteHistory.save();
      console.log("STEP: after quoteHistory.save rejectQuote", {
        quoteHistoryId: quoteHistory.id,
      });

      // Create notification for issuer
      const issuerNotification = new Notification({
        recipientId: quote.user.id,
        senderId: userId,
        title: "RFQ Rejected",
        message: `Your RFQ #${quote.quote_number} has been rejected by ${quote.destinatary_user.firstName} ${quote.destinatary_user.surname}${reason ? ". Reason: " + reason : ""}`,
        type: "error",
        category: "system",
        metadata: {
          quoteId: quote.id,
          quoteNumber: quote.quote_number,
          recipientName: `${quote.destinatary_user.firstName} ${quote.destinatary_user.surname}`,
          reason,
        },
      });
      console.log("STEP: before issuerNotification.save rejectQuote", {
        quoteId: quote.id,
      });
      await issuerNotification.save();
      console.log("STEP: after issuerNotification.save rejectQuote", {
        notificationId: issuerNotification.id,
      });

      // Create notification for recipient
      const recipientNotification = new Notification({
        recipientId: quote.destinatary_user.id,
        senderId: userId,
        title: "RFQ Rejected",
        message: `You have rejected RFQ #${quote.quote_number}${reason ? ". Reason: " + reason : ""}`,
        type: "info",
        category: "system",
        metadata: {
          quoteId: quote.id,
          quoteNumber: quote.quote_number,
          reason,
        },
      });
      console.log("STEP: before recipientNotification.save rejectQuote", {
        quoteId: quote.id,
      });
      await recipientNotification.save();
      console.log("STEP: after recipientNotification.save rejectQuote", {
        notificationId: recipientNotification.id,
      });

      // Send email notification to the issuer without blocking the response
      console.log("STEP: dispatch rejection email in background", {
        quoteId: quote.id,
      });
      User.findByPk(quote.user)
        .then((issuer) => {
          if (!issuer?.email) {
            console.error("Rejection email skipped: issuer email missing", {
              quoteId: quote.id,
            });
            return;
          }
          return sendEmail(
            issuer.email,
            "Quote Rejected",
            `Quote #${quote.quote_number} has been rejected by the recipient${reason ? ". Reason: " + reason : "."}`,
          );
        })
        .then((info) => {
          if (info) {
            console.log("STEP: rejection email sent", {
              quoteId: quote.id,
              response: info.response,
            });
          }
        })
        .catch((emailError) => {
          console.error("Error sending rejection email:", emailError);
        });
    });

    const responseQuote = quote.toObject ? quote.toObject() : quote;

    return res.status(200).json({
      success: true,
      message: "Quote rejected successfully",
      data: responseQuote,
    });
  } catch (error) {
    console.error("Error in rejectQuote:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error rejecting quote",
    });
  }
};

// Check and send notifications for pending quotes
const checkQuoteNotifications = async () => {
  try {
    const now = new Date();

    // Find quotes that need response notification (72 hours)
    const pendingQuotes = await Quote.findAll({ where: { status: "Pending", responseNotificationDue: { [Op.lte]: now }, notificationSent: false } });

    for (const quote of pendingQuotes) {
      try {
        // Create notification for recipient about pending response
        const reminderNotification = new Notification({
          recipientId: quote.destinatary_user.id,
          senderId: quote.user.id,
          title: "RFQ Response Required",
          message: `RFQ #${quote.quote_number} requires your response. Please respond within 72 hours.`,
          type: "warning",
          category: "system",
          metadata: {
            quoteId: quote.id,
            quoteNumber: quote.quote_number,
            senderName: `${quote.user.firstName} ${quote.user.surname}`,
          },
        });
        await reminderNotification.save();

        quote.notificationSent = true;
        await quote.save();
      } catch (error) {
        console.error(
          `Error sending notification for quote ${quote.quote_number}:`,
          error,
        );
      }
    }

    // Find quotes that are about to be deleted (13 days after response)
    const quotesToDelete = await Quote.findAll({ where: {
      status: { [Op.in]: ["Accepted", "Rejected"] },
      updatedAt: {
        [Op.lte]: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000),
        [Op.gt]: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      },
      deletionNotificationSent: { [Op.ne]: true },
    } });

    for (const quote of quotesToDelete) {
      try {
        // Create deletion notification for issuer
        const issuerDeletionNotification = new Notification({
          recipientId: quote.user.id,
          senderId: quote.user.id,
          title: "RFQ Deletion Notice",
          message: `RFQ #${quote.quote_number} will be deleted in 24 hours.`,
          type: "warning",
          category: "system",
          metadata: {
            quoteId: quote.id,
            quoteNumber: quote.quote_number,
          },
        });
        await issuerDeletionNotification.save();

        // Create deletion notification for recipient
        const recipientDeletionNotification = new Notification({
          recipientId: quote.destinatary_user.id,
          senderId: quote.user.id,
          title: "RFQ Deletion Notice",
          message: `RFQ #${quote.quote_number} will be deleted in 24 hours.`,
          type: "warning",
          category: "system",
          metadata: {
            quoteId: quote.id,
            quoteNumber: quote.quote_number,
          },
        });
        await recipientDeletionNotification.save();

        quote.deletionNotificationSent = true;
        await quote.save();
      } catch (error) {
        console.error(
          `Error sending deletion notification for quote ${quote.quote_number}:`,
          error,
        );
      }
    }

    // Delete quotes that are 14 days old after response
    const deleteQuotes = await Quote.findAll({ where: { status: { [Op.in]: ["Accepted", "Rejected"] }, updatedAt: { [Op.lte]: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) } } });

    for (const quote of deleteQuotes) {
      await quote.destroy();
      const history = await QuoteHistory.findOne({ where: { quote: quote.id } });
      if (history) await history.update({
          status: "Deleted",
          action: "Automatic Deletion",
          deletedAt: now,
      });
    }
  } catch (error) {
    console.error("Error in checkQuoteNotifications:", error);
  }
};

// Get a single quote by ID
const getQuoteById = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user.id;

    const quote = await Quote.findByPk(quoteId);

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "Quote not found",
      });
    }

    // Check if the user has permission to view this quote
    if (
      quote.user.id.toString() !== userId.toString() &&
      quote.destinatary_user.id.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this quote",
      });
    }

    res.json({
      success: true,
      data: quote,
    });
  } catch (error) {
    console.error("Error fetching quote:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quote",
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
  getQuoteById,
};
