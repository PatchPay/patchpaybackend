const Escrow = require("../models/Escrow");
const Quote = require("../models/Quote");
const Payment = require("../models/Payment");
const User = require("../models/User");
const sequelize = require("../config/database");
const { Op } = require("sequelize");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const { formatAmount } = require("../utils/accountUtils");

const {
  generateUPRN,
  generateEscrowTransferUPRN,
  transactionNeedsUPRN,
} = require("../utils/paymentUtils");

const { ApiError } = require("../utils/ApiError");

const fs = require("fs");

const {
  confirmReceiptAndRelease,
} = require("../services/escrowRelease.service");

const {
  createNotification,
} = require("../services/notificationService");

// ============================================================
// SAFE USER ATTRIBUTES
// ============================================================

const SAFE_ESCROW_USER_ATTRIBUTES = [
  "id",
  "accountType",
  "firstName",
  "middleName",
  "surname",
  "email",
  "phoneNumber",
  "businessName",
  "industry",
  "companyAddress",
];

// ============================================================
// CREATE ESCROW
// ============================================================

const createEscrow = async (req, res) => {
  const transactionDb = await sequelize.transaction();

  try {
    const { quoteid } = req.body;

    // --------------------------------------------------------
    // Find quote
    // --------------------------------------------------------

    const quote = await Quote.findByPk(quoteid, {
      transaction: transactionDb,
    });

    if (!quote) {
      await transactionDb.rollback();

      return res.status(404).json({
        success: false,
        message: "Quote not found",
      });
    }

    // --------------------------------------------------------
    // Quote must be accepted
    // --------------------------------------------------------

    if (quote.status !== "Accepted") {
      await transactionDb.rollback();

      return res.status(400).json({
        success: false,
        message: "Can only create escrow for accepted quotes",
      });
    }

    // --------------------------------------------------------
    // Only seller can create escrow
    // --------------------------------------------------------

    if (
      String(quote.user_data?.id) !==
      String(req.user.id)
    ) {
      await transactionDb.rollback();

      return res.status(403).json({
        success: false,
        message:
          "Only the seller can create escrow for this RFQ",
      });
    }

    // --------------------------------------------------------
    // Check existing escrow
    // --------------------------------------------------------

    const existingEscrow = await Escrow.findOne({
      where: sequelize.where(
        sequelize.json("metadata.quoteid"),
        String(quote.id)
      ),
      transaction: transactionDb,
    });

    if (existingEscrow) {
      await transactionDb.rollback();

      return res.status(400).json({
        success: false,
        message: "Escrow already exists for this quote",
      });
    }

    // --------------------------------------------------------
    // Generate escrow UPRN
    // --------------------------------------------------------

    const escrowUprn = await generateUPRN(
      quote.user_data.id,
      "escrow_release"
    );

    // --------------------------------------------------------
    // Expiry date
    // --------------------------------------------------------

    const expiryDate = new Date();

    expiryDate.setDate(
      expiryDate.getDate() + 30
    );

    // --------------------------------------------------------
    // Create escrow
    // --------------------------------------------------------

    const escrow = await Escrow.create(
      {
        creatorId:
          quote.user_data.id,

        recipientId:
          quote.destinatary_user.id,

        amount:
          quote.total,

        currentBalance:
          quote.total,

        currency:
          quote.currency,

        status:
          "CREATED",

        escrowUprn,

        conditions:
          `Escrow for Quote #${quote.quote_number}`,

        description:
          quote.product_description,

        expiryDate,

        metadata: {
          quoteid:
            quote.id,

          quote_number:
            quote.quote_number,

          product_quantity:
            quote.product_quantity,

          delivery_type:
            quote.delivery_type,

          trade_type:
            quote.trade_type,

          delivery_code:
            quote.delivery_code,

          line_total:
            quote.line_total,

          delivery_charge:
            quote.delivery_charge,

          transaction_charges:
            quote.transaction_charges,

          subtotal:
            quote.subtotal,

          exchange_rate:
            quote.exchange_rate,
        },
      },
      {
        transaction:
          transactionDb,
      }
    );

    // --------------------------------------------------------
    // Commit escrow creation
    // --------------------------------------------------------

    await transactionDb.commit();

    // ========================================================
    // 🔔 NOTIFICATION: ESCROW CREATED
    // ========================================================

    await createNotification({
      recipientId:
        escrow.recipientId,

      senderId:
        escrow.creatorId,

      title:
        "Escrow Created",

      message:
        `An escrow of ${escrow.amount} ` +
        `${escrow.currency} has been created for ` +
        `Quote #${quote.quote_number}.`,

      type:
        "info",

      category:
        "escrow",

      metadata: {
        event:
          "escrow_created",

        escrowId:
          escrow.id,

        escrowUprn:
          escrow.escrowUprn,

        quoteId:
          quote.id,

        quoteNumber:
          quote.quote_number,

        amount:
          escrow.amount,

        currency:
          escrow.currency,

        status:
          escrow.status,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Escrow created successfully",
      data: escrow,
    });
  } catch (error) {
    try {
      await transactionDb.rollback();
    } catch (rollbackError) {
      console.error(
        "Escrow rollback failed:",
        rollbackError.message
      );
    }

    console.error(
      "Error creating escrow:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create escrow",
    });
  }
};

// ============================================================
// GET ALL ESCROWS
// ============================================================

const getEscrows = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      status,
      role,
    } = req.query;

    let query = {};

    // --------------------------------------------------------
    // Filter by role
    // --------------------------------------------------------

    if (role === "creator") {
      query.creatorId = userId;
    } else if (role === "recipient") {
      query.recipientId = userId;
    } else {
      query[Op.or] = [
        {
          creatorId: userId,
        },
        {
          recipientId: userId,
        },
      ];
    }

    // --------------------------------------------------------
    // Filter by status
    // --------------------------------------------------------

    if (status) {
      query.status = status;
    }

    // --------------------------------------------------------
    // Fetch escrows
    // --------------------------------------------------------

    const escrows = await Escrow.findAll({
      where: query,

      include: [
        {
          association: "creator",
          attributes:
            SAFE_ESCROW_USER_ATTRIBUTES,
        },
        {
          association: "recipient",
          attributes:
            SAFE_ESCROW_USER_ATTRIBUTES,
        },
      ],

      order: [
        ["createdAt", "DESC"],
      ],
    });

    // --------------------------------------------------------
    // Attach quotes
    // --------------------------------------------------------

    const escrowsWithQuotes =
      await Promise.all(
        escrows.map(
          async (escrow) => {
            if (
              escrow.metadata &&
              escrow.metadata.quoteid
            ) {
              const quote =
                await Quote.findByPk(
                  escrow.metadata.quoteid,
                  {
                    attributes: [
                      "quote_number",
                      "status",
                      "total",
                      "currency",
                    ],
                  }
                );

              return {
                ...escrow.toJSON(),

                quote:
                  quote
                    ? quote.toJSON()
                    : null,
              };
            }

            return escrow.toJSON();
          }
        )
      );

    return res.json({
      success: true,
      data:
        escrowsWithQuotes,
    });
  } catch (error) {
    console.error(
      "Error fetching escrows:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch escrows",
    });
  }
};

// ============================================================
// GET MY ESCROWS
// ============================================================

const getMyEscrows = async (
  req,
  res
) => {
  try {
    const userId =
      req.user.id;

    const escrows =
      await Escrow.findAll({
        where: {
          [Op.or]: [
            {
              creatorId:
                userId,
            },
            {
              recipientId:
                userId,
            },
          ],
        },

        include: [
          {
            association:
              "creator",

            attributes:
              SAFE_ESCROW_USER_ATTRIBUTES,
          },

          {
            association:
              "recipient",

            attributes:
              SAFE_ESCROW_USER_ATTRIBUTES,
          },
        ],

        order: [
          ["createdAt", "DESC"],
        ],
      });

    return res.status(200).json({
      success: true,
      data: escrows,
    });
  } catch (error) {
    console.error(
      "Error getting user escrows:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch escrows",
    });
  }
};

// ============================================================
// GET ESCROW BY ID
// ============================================================

const getEscrowById = async (
  req,
  res
) => {
  try {
    const escrow =
      await Escrow.findByPk(
        req.params.id,
        {
          include: [
            {
              association:
                "creator",

              attributes:
                SAFE_ESCROW_USER_ATTRIBUTES,
            },

            {
              association:
                "recipient",

              attributes:
                SAFE_ESCROW_USER_ATTRIBUTES,
            },

            {
              association:
                "fundingTransaction",
            },

            {
              association:
                "releaseTransaction",
            },

            {
              association:
                "refundTransaction",
            },
          ],
        }
      );

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message:
          "Escrow not found",
      });
    }

    // --------------------------------------------------------
    // Fetch associated quote
    // --------------------------------------------------------

    let quote = null;

    if (
      escrow.metadata &&
      escrow.metadata.quoteid
    ) {
      quote =
        await Quote.findByPk(
          escrow.metadata.quoteid,
          {
            attributes: [
              "quote_number",
              "status",
              "total",
              "currency",
              "product_description",
              "delivery_type",
              "trade_type",
            ],
          }
        );
    }

    return res.json({
      success: true,

      data: {
        ...escrow.toJSON(),

        quote:
          quote
            ? quote.toJSON()
            : null,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching escrow:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch escrow",
    });
  }
};

// ============================================================
// REMOVE DELIVERY PROOF FILE
// ============================================================

const removeDeliveryProofFile = async (
  filePath,
  reason
) => {
  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(
      filePath
    );

    console.log(
      "[escrow-deliver] CLEANUP",
      {
        reason,
        filePath,
      }
    );
  } catch (error) {
    if (
      error.code !== "ENOENT"
    ) {
      console.error(
        "[escrow-deliver] CLEANUP FAILED",
        {
          reason,
          filePath,
          message:
            error.message,
        }
      );
    }
  }
};

// ============================================================
// MARK ESCROW AS DELIVERED
// ============================================================

const markEscrowDelivered = async (
  req,
  res
) => {
  const escrowId =
    req.params.id;

  const userId =
    req.user.id;

  const uploadedFilePath =
    req.file?.path;

  // --------------------------------------------------------
  // Debug request
  // --------------------------------------------------------

  console.log(
    "[escrow-deliver] REQUEST DEBUG:",
    {
      escrowId,
      userId,
      hasFile:
        !!req.file,

      fileField:
        req.file?.fieldname,

      fileName:
        req.file?.originalname,

      storedFileName:
        req.file?.filename,

      mimeType:
        req.file?.mimetype,

      fileSize:
        req.file?.size,

      filePath:
        req.file?.path,
    }
  );

  // --------------------------------------------------------
  // Validate uploaded file
  // --------------------------------------------------------

  if (!req.file) {
    console.log(
      "[escrow-deliver] ❌ NO FILE RECEIVED"
    );

    return res.status(400).json({
      success: false,
      message:
        "A deliveryProof image file is required",
    });
  }

  if (!req.file.path) {
    console.log(
      "[escrow-deliver] FILE PATH MISSING"
    );

    return res.status(400).json({
      success: false,
      message:
        "Delivery-proof file was received but could not be stored",
    });
  }

  let transactionDb =
    null;

  try {
    // --------------------------------------------------------
    // Start transaction
    // --------------------------------------------------------

    transactionDb =
      await sequelize.transaction();

    // --------------------------------------------------------
    // Fetch escrow with row lock
    // --------------------------------------------------------

    const escrow =
      await Escrow.findByPk(
        escrowId,
        {
          transaction:
            transactionDb,

          lock:
            transactionDb.LOCK.UPDATE,
        }
      );

    if (!escrow) {
      await transactionDb.rollback();

      transactionDb = null;

      await removeDeliveryProofFile(
        uploadedFilePath,
        "escrow not found"
      );

      return res.status(404).json({
        success: false,
        message:
          "Escrow not found",
      });
    }

    // --------------------------------------------------------
    // Authorization
    // Seller = creator
    // --------------------------------------------------------

    const creatorMatch =
      String(userId) ===
      String(escrow.creatorId);

    const recipientMatch =
      String(userId) ===
      String(escrow.recipientId);

    console.log(
      "[escrow-deliver] ROLE CHECK:",
      {
        escrowId:
          escrow.id,

        userId,

        creatorId:
          escrow.creatorId,

        recipientId:
          escrow.recipientId,

        creatorMatch,

        recipientMatch,

        status:
          escrow.status,
      }
    );

    if (!creatorMatch) {
      await transactionDb.rollback();

      transactionDb = null;

      await removeDeliveryProofFile(
        uploadedFilePath,
        "seller authorization failed"
      );

      return res.status(403).json({
        success: false,
        message:
          "Only the seller can submit delivery proof",
      });
    }

    // --------------------------------------------------------
    // Check escrow state
    // --------------------------------------------------------

    if (
      escrow.status !==
      "FUNDED"
    ) {
      await transactionDb.rollback();

      transactionDb = null;

      await removeDeliveryProofFile(
        uploadedFilePath,
        "invalid escrow state"
      );

      return res.status(400).json({
        success: false,
        message:
          `Delivery proof can only be submitted when escrow is FUNDED. Current status: ${escrow.status}`,
      });
    }

    // --------------------------------------------------------
    // Prevent duplicate proof
    // --------------------------------------------------------

    if (
      escrow.deliveryProofUrl ||
      escrow.deliveryProofPublicId
    ) {
      await transactionDb.rollback();

      transactionDb = null;

      await removeDeliveryProofFile(
        uploadedFilePath,
        "duplicate delivery proof"
      );

      return res.status(409).json({
        success: false,
        message:
          "Delivery proof has already been submitted",
      });
    }

    // --------------------------------------------------------
    // Mark delivered
    // --------------------------------------------------------

    const deliveredAt =
      new Date();

    await escrow.update(
      {
        deliveryProofUrl:
          `/uploads/delivery-proofs/${req.file.filename}`,

        deliveryProofPublicId:
          null,

        sellerDeliveredAt:
          deliveredAt,

        status:
          "DELIVERED",
      },
      {
        transaction:
          transactionDb,
      }
    );

    // --------------------------------------------------------
    // Commit
    // --------------------------------------------------------

    await transactionDb.commit();

    transactionDb = null;

    console.log(
      "[escrow-deliver] DELIVERY SUCCESS",
      {
        escrowId:
          escrow.id,

        userId,

        status:
          escrow.status,

        deliveryProofUrl:
          escrow.deliveryProofUrl,
      }
    );

    // ========================================================
    // 🔔 NOTIFICATION: ESCROW DELIVERED
    // ========================================================

    await createNotification({
      recipientId:
        escrow.recipientId,

      senderId:
        escrow.creatorId,

      title:
        "Order Delivered",

      message:
        `The seller has marked escrow #${escrow.escrowUprn} as delivered. Please review the delivery and confirm receipt.`,

      type:
        "info",

      category:
        "escrow",

      metadata: {
        event:
          "escrow_delivered",

        escrowId:
          escrow.id,

        escrowUprn:
          escrow.escrowUprn,

        amount:
          escrow.amount,

        currency:
          escrow.currency,

        status:
          escrow.status,

        deliveryProofUrl:
          escrow.deliveryProofUrl,

        sellerDeliveredAt:
          escrow.sellerDeliveredAt,
      },
    });

    return res.status(200).json({
      success: true,

      message:
        "Delivery proof submitted; escrow marked as delivered",

      data: {
        id:
          escrow.id,

        status:
          escrow.status,

        deliveryProofUrl:
          escrow.deliveryProofUrl,

        sellerDeliveredAt:
          escrow.sellerDeliveredAt,
      },
    });
  } catch (error) {
    // --------------------------------------------------------
    // Rollback
    // --------------------------------------------------------

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

    await removeDeliveryProofFile(
      uploadedFilePath,
      "database transaction failed"
    );

    console.error(
      "[escrow-deliver] Error marking escrow delivered:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit delivery proof",
    });
  }
};

// ============================================================
// CONFIRM ESCROW RECEIPT + RELEASE
// ============================================================

// ============================================================
// BUYER CONFIRMS RECEIPT
// Buyer uploads proof of the actual goods received
// ============================================================

const confirmEscrowReceipt = async (req, res) => {
  const escrowId = req.params.id;
  const userId = req.user.id;

  const uploadedFilePath = req.file?.path;

  try {
    // --------------------------------------------------------
    // 1. Buyer must upload an image
    // --------------------------------------------------------

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "A buyer confirmation image is required",
      });
    }

    if (!req.file.path) {
      return res.status(400).json({
        success: false,
        message:
          "Buyer confirmation image was received but could not be stored",
      });
    }

    // --------------------------------------------------------
    // 2. Find escrow
    // --------------------------------------------------------

    const escrow = await Escrow.findByPk(escrowId);

    if (!escrow) {
      await removeDeliveryProofFile(
        uploadedFilePath,
        "escrow not found"
      );

      return res.status(404).json({
        success: false,
        message: "Escrow not found",
      });
    }

    // --------------------------------------------------------
    // 3. ONLY BUYER / RECIPIENT CAN CONFIRM
    // --------------------------------------------------------

    const buyerMatch =
      String(userId) === String(escrow.recipientId);

    if (!buyerMatch) {
      await removeDeliveryProofFile(
        uploadedFilePath,
        "buyer authorization failed"
      );

      return res.status(403).json({
        success: false,
        message:
          "Only the buyer can confirm receipt",
      });
    }

    // --------------------------------------------------------
    // 4. Seller must have delivered first
    // --------------------------------------------------------

    if (escrow.status !== "DELIVERED") {
      await removeDeliveryProofFile(
        uploadedFilePath,
        "invalid escrow state"
      );

      return res.status(400).json({
        success: false,
        message:
          `Buyer can only confirm receipt after the seller has marked the order as delivered. Current status: ${escrow.status}`,
      });
    }

    // --------------------------------------------------------
    // 5. Prevent duplicate buyer confirmation
    // --------------------------------------------------------

    if (
      escrow.buyerReceived ||
      escrow.buyerConfirmationProofUrl
    ) {
      await removeDeliveryProofFile(
        uploadedFilePath,
        "duplicate buyer confirmation"
      );

      return res.status(409).json({
        success: false,
        message:
          "Receipt has already been confirmed",
      });
    }

    // --------------------------------------------------------
    // 6. Save buyer confirmation proof
    // --------------------------------------------------------

    const buyerConfirmedAt = new Date();

    await escrow.update({
      buyerConfirmationProofUrl:
        `/uploads/receipt-confirmations/${req.file.filename}`,

      buyerConfirmationProofPublicId:
        null,

      buyerReceived: true,

      buyerReceivedAt:
        buyerConfirmedAt,

      status: "RECEIVED",
    });

    // --------------------------------------------------------
    // 7. Release escrow
    // --------------------------------------------------------

    const releasedEscrow =
      await confirmReceiptAndRelease(
        escrow.id,
        userId
      );

    // --------------------------------------------------------
    // 8. Notify seller
    // --------------------------------------------------------

    await createNotification({
      recipientId:
        releasedEscrow.creatorId,

      senderId:
        releasedEscrow.recipientId,

      title:
        "Escrow Funds Released",

      message:
        `The buyer has confirmed receipt of the goods. ${releasedEscrow.amount} ${releasedEscrow.currency} has been released to you.`,

      type: "success",

      category: "escrow",

      metadata: {
        event: "escrow_released",

        escrowId:
          releasedEscrow.id,

        escrowUprn:
          releasedEscrow.escrowUprn,

        amount:
          releasedEscrow.amount,

        currency:
          releasedEscrow.currency,

        status:
          releasedEscrow.status,

        buyerConfirmationProofUrl:
          releasedEscrow.buyerConfirmationProofUrl,

        buyerReceivedAt:
          releasedEscrow.buyerReceivedAt,

        releaseTransactionId:
          releasedEscrow.releaseTransactionId,
      },
    });

    // --------------------------------------------------------
    // 9. Response
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Receipt confirmed and escrow funds released to the seller",

      data: {
        id: releasedEscrow.id,

        status:
          releasedEscrow.status,

        buyerReceived:
          releasedEscrow.buyerReceived,

        buyerReceivedAt:
          releasedEscrow.buyerReceivedAt,

        buyerConfirmationProofUrl:
          releasedEscrow.buyerConfirmationProofUrl,

        releaseTransactionId:
          releasedEscrow.releaseTransactionId,
      },
    });
  } catch (error) {
    await removeDeliveryProofFile(
      uploadedFilePath,
      "buyer confirmation failed"
    );

    console.error(
      "Error confirming escrow receipt:",
      error
    );

    const statusCode =
      error.statusCode || 500;

    return res.status(statusCode).json({
      success: false,
      message:
        statusCode >= 500
          ? "Failed to confirm receipt and release escrow"
          : error.message,
    });
  }
};

// ============================================================
// RELEASE ESCROW
// ============================================================

const releaseEscrow = async (
  req,
  res
) => {
  try {
    const escrow =
      await confirmReceiptAndRelease(
        req.params.id,
        req.user.id
      );

    // ========================================================
    // 🔔 NOTIFICATION: ESCROW RELEASED
    // ========================================================

    await createNotification({
      recipientId:
        escrow.creatorId,

      senderId:
        escrow.recipientId,

      title:
        "Escrow Funds Released",

      message:
        `Escrow #${escrow.escrowUprn} has been released. ${escrow.amount} ${escrow.currency} has been released to you.`,

      type:
        "success",

      category:
        "escrow",

      metadata: {
        event:
          "escrow_released",

        escrowId:
          escrow.id,

        escrowUprn:
          escrow.escrowUprn,

        amount:
          escrow.amount,

        currency:
          escrow.currency,

        status:
          escrow.status,

        releaseTransactionId:
          escrow.releaseTransactionId,
      },
    });

    return res.json({
      success: true,

      message:
        "Escrow funds released to the seller",

      data:
        escrow,
    });
  } catch (error) {
    const statusCode =
      error.statusCode || 500;

    if (statusCode >= 500) {
      console.error(
        "Error releasing escrow:",
        error.message
      );

      return res.status(
        statusCode
      ).json({
        success: false,
        message:
          "Failed to release escrow",
      });
    }

    return res.status(
      statusCode
    ).json({
      success: false,
      message:
        error.message,
    });
  }
};

// ============================================================
// REFUND ESCROW
// ============================================================

const refundEscrow = async (
  req,
  res
) => {
  try {
    const {
      transactionId,
    } = req.body;

    const escrow =
      await Escrow.findByPk(
        req.params.id
      );

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message:
          "Escrow not found",
      });
    }

    if (
      escrow.status !==
      "FUNDED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Escrow cannot be refunded in its current state",
      });
    }

    escrow.status =
      "REFUNDED";

    escrow.refundTransactionId =
      transactionId;

    await escrow.save();

    // ========================================================
    // 🔔 NOTIFICATION: REFUND
    // ========================================================

    await createNotification({
      recipientId:
        escrow.recipientId,

      senderId:
        escrow.creatorId,

      title:
        "Escrow Refunded",

      message:
        `Escrow #${escrow.escrowUprn} has been refunded. The escrow amount was ${escrow.amount} ${escrow.currency}.`,

      type:
        "info",

      category:
        "escrow",

      metadata: {
        event:
          "escrow_refunded",

        escrowId:
          escrow.id,

        escrowUprn:
          escrow.escrowUprn,

        amount:
          escrow.amount,

        currency:
          escrow.currency,

        status:
          escrow.status,

        refundTransactionId:
          escrow.refundTransactionId,
      },
    });

    return res.json({
      success: true,

      message:
        "Escrow refunded successfully",

      data:
        escrow,
    });
  } catch (error) {
    console.error(
      "Error refunding escrow:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to refund escrow",
    });
  }
};

// ============================================================
// DISPUTE ESCROW
// ============================================================

const disputeEscrow = async (
  req,
  res
) => {
  try {
    const {
      reason,
    } = req.body;

    const escrow =
      await Escrow.findByPk(
        req.params.id
      );

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message:
          "Escrow not found",
      });
    }

    if (
      escrow.status !==
        "FUNDED" &&
      escrow.status !==
        "DELIVERED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Escrow cannot be disputed in its current state",
      });
    }

    escrow.status =
      "DISPUTED";

    escrow.metadata = {
      ...escrow.metadata,

      disputeReason:
        reason,
    };

    await escrow.save();

    // ========================================================
    // 🔔 NOTIFICATION: DISPUTE
    // ========================================================

    // Notify the other party.
    const notificationRecipientId =
      String(escrow.creatorId) ===
      String(req.user.id)
        ? escrow.recipientId
        : escrow.creatorId;

    await createNotification({
      recipientId:
        notificationRecipientId,

      senderId:
        req.user.id,

      title:
        "Escrow Disputed",

      message:
        `Escrow #${escrow.escrowUprn} has been disputed.` +
        (reason
          ? ` Reason: ${reason}`
          : ""),

      type:
        "error",

      category:
        "escrow",

      metadata: {
        event:
          "escrow_disputed",

        escrowId:
          escrow.id,

        escrowUprn:
          escrow.escrowUprn,

        amount:
          escrow.amount,

        currency:
          escrow.currency,

        status:
          escrow.status,

        reason:
          reason || null,

        disputedBy:
          req.user.id,
      },
    });

    return res.json({
      success: true,

      message:
        "Escrow disputed successfully",

      data:
        escrow,
    });
  } catch (error) {
    console.error(
      "Error disputing escrow:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to dispute escrow",
    });
  }
};

// ============================================================
// CANCEL ESCROW
// ============================================================

const cancelEscrow = async (
  req,
  res
) => {
  try {
    const escrow =
      await Escrow.findByPk(
        req.params.id
      );

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message:
          "Escrow not found",
      });
    }

    if (
      escrow.status !==
      "CREATED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Escrow cannot be cancelled in its current state",
      });
    }

    escrow.status =
      "CANCELLED";

    await escrow.save();

    // ========================================================
    // 🔔 NOTIFICATION: CANCELLED
    // ========================================================

    const notificationRecipientId =
      String(escrow.creatorId) ===
      String(req.user.id)
        ? escrow.recipientId
        : escrow.creatorId;

    await createNotification({
      recipientId:
        notificationRecipientId,

      senderId:
        req.user.id,

      title:
        "Escrow Cancelled",

      message:
        `Escrow #${escrow.escrowUprn} has been cancelled.`,

      type:
        "info",

      category:
        "escrow",

      metadata: {
        event:
          "escrow_cancelled",

        escrowId:
          escrow.id,

        escrowUprn:
          escrow.escrowUprn,

        amount:
          escrow.amount,

        currency:
          escrow.currency,

        status:
          escrow.status,

        cancelledBy:
          req.user.id,
      },
    });

    return res.json({
      success: true,

      message:
        "Escrow cancelled successfully",

      data:
        escrow,
    });
  } catch (error) {
    console.error(
      "Error cancelling escrow:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to cancel escrow",
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

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
  cancelEscrow,
};