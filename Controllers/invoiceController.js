const sequelize = require("../config/database");

const Escrow = require("../models/Escrow");
const Invoice = require("../models/Invoice");
const Quote = require("../models/Quote");
const Transaction = require("../models/Transaction");
const User = require("../models/User");

const squadService = require("../services/squad.service");
const { generateUPRN } = require("../utils/paymentUtils");
const { createNotification } = require("../services/notificationService");

// ============================================================
// BUILD INVOICE FROM ACCEPTED QUOTE
// ============================================================

const buildInvoiceFromAcceptedQuote = async (quote, transaction = null) => {
  // The RFQ creator is the seller; the recipient is the buyer.
  const requesterId = quote.user_data?.id;
  const recipientId = quote.destinatary_user?.id;

  if (!requesterId || !recipientId) {
    const error = new Error("Quote is missing requester or recipient data");
    error.statusCode = 400;
    throw error;
  }

  if (!quote.product_description) {
    const error = new Error("Quote is missing product description");
    error.statusCode = 400;
    throw error;
  }

  const amount = Number(quote.total || quote.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("Quote is missing a valid invoice amount");
    error.statusCode = 400;
    throw error;
  }

  console.log(
    "STEP: before Invoice.findOne createInvoiceFromAcceptedQuote",
    {
      quoteId: quote.id,
    }
  );

  const existingInvoice = await Invoice.findOne({
    where: { rfqId: quote.id },
    transaction,
  });

  console.log(
    "STEP: after Invoice.findOne createInvoiceFromAcceptedQuote",
    {
      quoteId: quote.id,
      invoiceFound: !!existingInvoice,
    }
  );

  if (existingInvoice) {
    if (!quote.invoice) {
      quote.invoice = existingInvoice.id;

      console.log(
        "STEP: before quote.save existing invoice createInvoiceFromAcceptedQuote",
        {
          quoteId: quote.id,
          invoiceId: existingInvoice.id,
        }
      );

      await quote.save({ transaction });

      console.log(
        "STEP: after quote.save existing invoice createInvoiceFromAcceptedQuote",
        {
          quoteId: quote.id,
          invoiceId: existingInvoice.id,
        }
      );
    }

    const error = new Error("Invoice already exists for this quote");
    error.statusCode = 409;
    error.invoice = existingInvoice;

    throw error;
  }

  console.log(
    "STEP: before Invoice.create createInvoiceFromAcceptedQuote",
    {
      quoteId: quote.id,
    }
  );

  const invoice = await Invoice.create(
    {
      rfqId: quote.id,
      requesterId,
      recipientId,
      amount,
      currency: quote.currency || "NGN",
      description: quote.product_description,
      status: "pending",
      paymentStatus: "unpaid",

      metadata: {
        quoteNumber: quote.quote_number,
        productQuantity: quote.product_quantity,
      },
    },
    { transaction }
  );

  console.log(
    "STEP: after Invoice.create createInvoiceFromAcceptedQuote",
    {
      quoteId: quote.id,
      invoiceId: invoice?.id,
    }
  );

  quote.invoice = invoice.id;

  console.log(
    "STEP: before quote.save new invoice createInvoiceFromAcceptedQuote",
    {
      quoteId: quote.id,
      invoiceId: invoice.id,
    }
  );

  await quote.save({ transaction });

  // ============================================================
  // 🔔 NOTIFICATION: INVOICE GENERATED
  // ============================================================

  await createNotification({
    recipientId,
    senderId: requesterId,

    title: "New Invoice Received",

    message: `A new invoice has been generated for ${amount} ${
      quote.currency || "NGN"
    }. Please review and make payment.`,

    type: "info",
    category: "invoice",

    metadata: {
      event: "invoice_generated",
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      quoteId: quote.id,
      amount,
      currency: quote.currency || "NGN",
    },

    transaction,
  });

  console.log(
    "STEP: after quote.save new invoice createInvoiceFromAcceptedQuote",
    {
      quoteId: quote.id,
      invoiceId: invoice.id,
    }
  );

  return invoice;
};

// ============================================================
// AMOUNT MATCH CHECK
// ============================================================

const amountsMatch = (providerAmount, invoiceAmount) => {
  const gatewayAmount = Number(
    String(providerAmount).replace(/,/g, "")
  );

  const expectedAmount = Number(
    String(invoiceAmount).replace(/,/g, "")
  );

  if (
    !Number.isFinite(gatewayAmount) ||
    !Number.isFinite(expectedAmount)
  ) {
    return false;
  }

  return (
    Math.abs(gatewayAmount - expectedAmount) < 0.01 ||
    Math.abs(gatewayAmount / 100 - expectedAmount) < 0.01
  );
};

// ============================================================
// CREATE INVOICE FROM ACCEPTED QUOTE
// ============================================================

exports.createInvoiceFromAcceptedQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;

    if (!Number.isInteger(Number(quoteId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid quote ID",
      });
    }

    const quote = await Quote.findByPk(quoteId);

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "Quote not found",
      });
    }

    const rfqCreatorId = String(quote.user_data?.id || "");
    const loggedInUserId = req.user.id.toString();

    console.log("========== INVOICE CHECK ==========");
    console.log("Logged In User:", loggedInUserId);
    console.log("RFQ Creator:", rfqCreatorId);
    console.log("RFQ Seller:", quote.user_data?.id);
    console.log("===================================");

    // Only RFQ creator can generate invoice
    if (rfqCreatorId !== loggedInUserId) {
      return res.status(403).json({
        success: false,
        message: "Only the seller can generate the invoice",
      });
    }

    if (quote.type !== "RFQ") {
      return res.status(400).json({
        success: false,
        message: "Invoice can only be created for an RFQ quote",
      });
    }

    if (quote.status !== "Accepted") {
      return res.status(400).json({
        success: false,
        message: "RFQ must be accepted before an invoice can be generated",
      });
    }

    const invoice = await buildInvoiceFromAcceptedQuote(quote);

    return res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: invoice,
    });
  } catch (error) {
    console.error(
      "Create invoice from accepted quote error:",
      error
    );

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Failed to create invoice from accepted quote",
      data: error.invoice
        ? { invoice: error.invoice }
        : undefined,
    });
  }
};

// ============================================================
// INITIATE INVOICE PAYMENT
// ============================================================

exports.initiateInvoicePayment = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findByPk(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Only buyer can pay
    if (
      invoice.recipientId.toString() !==
      req.user.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Only the buyer can pay this invoice",
      });
    }

    if (invoice.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Invoice has already been paid",
      });
    }

    const buyer = await User.findByPk(invoice.recipientId);

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: "Invoice buyer not found",
      });
    }

    const paymentReference =
      invoice.paymentReference ||
      `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const callbackUrl = `${
      process.env.FRONTEND_URL || "http://localhost:8081"
    }/api/invoices/callback`;

    const payment = await squadService.initiateCollection({
      amount: invoice.amount,
      email: buyer.email,
      currency: invoice.currency,
      transactionRef: paymentReference,
      callbackUrl,

      metadata: {
        invoiceId: invoice.id.toString(),
        rfqId: invoice.rfqId.toString(),
        paymentType: "invoice",
      },
    });

    invoice.paymentReference = paymentReference;
    invoice.checkoutUrl = payment.checkoutUrl;
    invoice.paymentStatus = "pending";
    invoice.gatewayResponse = payment.raw;

    await invoice.save();

    // ============================================================
    // 🔔 NOTIFICATION: PAYMENT INITIATED
    // ============================================================

    await createNotification({
      recipientId: invoice.requesterId,
      senderId: invoice.recipientId,

      title: "Invoice Payment Initiated",

      message: `Payment has been initiated for invoice ${
        invoice.invoice_number || `#${invoice.id}`
      }. Please wait for payment verification.`,

      type: "info",
      category: "invoice",

      metadata: {
        event: "invoice_payment_initiated",
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        paymentReference,
        amount: invoice.amount,
        currency: invoice.currency,
      },
    });

    return res.status(200).json({
      success: true,
      paymentUrl: payment.checkoutUrl,
      reference: paymentReference,
    });
  } catch (error) {
    console.error(
      "Invoice payment initiation error:",
      error
    );

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Failed to initiate invoice payment",
      error:
        error.providerResponse ||
        error.message,
    });
  }
};

// ============================================================
// HANDLE INVOICE CALLBACK
// ============================================================

exports.handleInvoiceCallback = async (req, res) => {
  const transaction_ref =
    req.query.reference ||
    req.query.transaction_ref ||
    req.query.paymentReference;

  if (!transaction_ref) {
    return res.send(`
      <h2>❌ Invalid Invoice Callback</h2>
      <p>No transaction reference found</p>
    `);
  }

  return res.send(`
    <!DOCTYPE html>

    <html>
      <head>
        <title>Invoice Payment Status</title>

        <style>
          body {
            font-family: Arial;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            flex-direction: column;
          }

          button {
            padding: 10px 20px;
            margin-top: 15px;
            cursor: pointer;
            background: #111;
            color: white;
            border: none;
          }

          .box {
            text-align: center;
          }
        </style>
      </head>

      <body>
        <div class="box">

          <h2>⏳ Processing Invoice Payment...</h2>

          <p>Transaction Ref:</p>

          <b>${transaction_ref}</b>

          <br />

          <button onclick="verifyInvoice()">
            Verify Invoice Payment
          </button>

          <p id="result"></p>

        </div>

        <script>
          async function verifyInvoice() {
            const res = await fetch(
              "/api/invoices/verify-payment",
              {
                method: "POST",

                headers: {
                  "Content-Type": "application/json"
                },

                body: JSON.stringify({
                  transactionRef: "${transaction_ref}"
                })
              }
            );

            const data = await res.json();

            const resultEl =
              document.getElementById("result");

            if (data.success) {
              resultEl.innerHTML =
                "✅ Invoice Paid Successfully!";
            } else {
              resultEl.innerHTML =
                "❌ Payment Failed: " +
                data.message;
            }
          }
        </script>
      </body>
    </html>
  `);
};

// ============================================================
// VERIFY INVOICE PAYMENT
// ============================================================

exports.verifyInvoicePayment = async (req, res) => {
  try {
    const transactionRef =
      req.body.transactionRef ||
      req.body.reference ||
      req.body.paymentReference;

    if (!transactionRef) {
      return res.status(400).json({
        success: false,
        message: "Transaction reference is required",
      });
    }

    const invoice = await Invoice.findOne({
      where: {
        paymentReference: transactionRef,
      },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice payment reference not found",
      });
    }

    // ============================================================
    // ALREADY PAID
    // ============================================================

    if (invoice.paymentStatus === "paid") {
      const escrow = invoice.escrowId
        ? await Escrow.findByPk(invoice.escrowId)
        : null;

      return res.status(200).json({
        success: true,
        message: "Invoice payment already verified",
        data: {
          invoice,
          escrow,
        },
      });
    }

    // ============================================================
    // VERIFY PAYMENT WITH SQUADCO
    // ============================================================

    const verification =
      await squadService.verifyCollection(
        transactionRef
      );

    console.log("================================");
    console.log("VERIFICATION RESPONSE");
    console.log(
      JSON.stringify(
        verification,
        null,
        2
      )
    );
    console.log("================================");

    invoice.gatewayResponse =
      verification.raw;

    const tx =
      verification.raw?.data || {};

    const isSuccessfulPayment =
      verification.raw?.status === 200 &&
      tx.transaction_status === "success";

    console.log(
      "TX STATUS:",
      tx.transaction_status
    );

    // ============================================================
    // 🔔 PAYMENT FAILED
    // ============================================================

    if (!isSuccessfulPayment) {
      invoice.paymentStatus = "failed";

      await invoice.save();

      await createNotification({
        recipientId: invoice.recipientId,
        senderId: invoice.requesterId,

        title: "Invoice Payment Failed",

        message: `Payment for invoice ${
          invoice.invoice_number || `#${invoice.id}`
        } could not be verified.`,

        type: "error",
        category: "invoice",

        metadata: {
          event: "invoice_payment_failed",
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          paymentReference: transactionRef,
          amount: invoice.amount,
          currency: invoice.currency,
        },
      });

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
        data: verification.raw,
      });
    }

    // ============================================================
    // CHECK PAYMENT AMOUNT
    // ============================================================

    console.log(
      "Invoice Amount:",
      invoice.amount
    );

    console.log(
      "Verification Amount:",
      verification.amount
    );

    console.log(
      "Amounts Match:",
      amountsMatch(
        verification.amount,
        invoice.amount
      )
    );

    // ============================================================
    // 🔔 AMOUNT MISMATCH
    // ============================================================

    if (
      !amountsMatch(
        verification.amount,
        invoice.amount
      )
    ) {
      invoice.paymentStatus = "failed";

      await invoice.save();

      await createNotification({
        recipientId: invoice.recipientId,
        senderId: invoice.requesterId,

        title: "Payment Amount Mismatch",

        message: `The payment amount for invoice ${
          invoice.invoice_number || `#${invoice.id}`
        } does not match the required invoice amount.`,

        type: "error",
        category: "invoice",

        metadata: {
          event:
            "invoice_payment_amount_mismatch",

          invoiceId: invoice.id,
          invoiceNumber:
            invoice.invoice_number,

          paymentReference:
            transactionRef,

          expectedAmount:
            invoice.amount,

          receivedAmount:
            verification.amount,

          currency:
            invoice.currency,
        },
      });

      return res.status(400).json({
        success: false,
        message:
          "Payment amount does not match invoice amount",
      });
    }

    // ============================================================
    // DATABASE TRANSACTION
    // ============================================================

    const transactionDb =
      await sequelize.transaction();

    try {
      // ============================================================
      // LOCK INVOICE
      // ============================================================

      const lockedInvoice =
        await Invoice.findByPk(
          invoice.id,
          {
            transaction: transactionDb,
            lock: transactionDb.LOCK.UPDATE,
          }
        );

      if (!lockedInvoice) {
        const error =
          new Error("Invoice not found");

        error.statusCode = 404;

        throw error;
      }

      // ============================================================
      // DOUBLE PAYMENT PROTECTION
      // ============================================================

      if (
        lockedInvoice.paymentStatus ===
        "paid"
      ) {
        await transactionDb.commit();

        return res.status(200).json({
          success: true,
          message:
            "Invoice payment already verified",
          data: {
            invoice: lockedInvoice,
          },
        });
      }

      // ============================================================
      // GET QUOTE
      // ============================================================

      const quote =
        await Quote.findByPk(
          lockedInvoice.rfqId,
          {
            transaction:
              transactionDb,
          }
        );

      if (!quote) {
        const error =
          new Error(
            "RFQ not found for invoice"
          );

        error.statusCode = 404;

        throw error;
      }

      // ============================================================
      // CREATE INVOICE PAYMENT TRANSACTION
      // ============================================================

      let invoiceTransaction =
        await Transaction.findOne({
          where: {
            reference:
              transactionRef,
          },

          transaction:
            transactionDb,
        });

      if (!invoiceTransaction) {
        invoiceTransaction =
          await Transaction.create(
            {
              type:
                "invoice_payment",

              amount:
                lockedInvoice.amount,

              total:
                lockedInvoice.amount,

              currency:
                lockedInvoice.currency,

              status:
                "success",

              senderId:
                lockedInvoice.recipientId,

              recipientId:
                lockedInvoice.requesterId,

              reference:
                transactionRef,

              externalReference:
                verification.providerReference,

              description:
                `Invoice payment for RFQ #${quote.quote_number}`,

              isUserAccountTransfer:
                false,

              paymentMethod:
                "bank",

              paymentGateway:
                "SquadCo",

              provider:
                "SquadCo",

              providerReference:
                verification.providerReference,

              providerResponses:
                [verification.raw],

              metadata: {
                invoiceId:
                  lockedInvoice.id,

                rfqId:
                  quote.id,

                quoteNumber:
                  quote.quote_number,
              },
            },
            {
              transaction:
                transactionDb,
            }
          );
      }

      // ============================================================
      // FIND EXISTING ESCROW
      // ============================================================

      let escrow =
        await Escrow.findOne({
          where:
            sequelize.where(
              sequelize.json(
                "metadata.invoiceid"
              ),
              lockedInvoice.id.toString()
            ),

          transaction:
            transactionDb,
        });

      // ============================================================
      // FIND EXISTING ESCROW FUNDING TRANSACTION
      // ============================================================

      let escrowFundingTransaction =
        lockedInvoice.escrowFundingTransactionId
          ? await Transaction.findByPk(
              lockedInvoice.escrowFundingTransactionId,
              {
                transaction:
                  transactionDb,
              }
            )
          : null;

      // ============================================================
      // CREATE ESCROW IF IT DOESN'T EXIST
      // ============================================================

      if (!escrow) {
        const escrowUprn =
          generateUPRN(
            lockedInvoice.requesterId,
            "escrow_release"
          );

        const expiryDate =
          new Date();

        expiryDate.setDate(
          expiryDate.getDate() + 30
        );

        // ========================================================
        // ESCROW FUNDING TRANSACTION
        // ========================================================

        escrowFundingTransaction =
          await Transaction.create(
            {
              type:
                "escrow_funding",

              amount:
                lockedInvoice.amount,

              total:
                lockedInvoice.amount,

              currency:
                lockedInvoice.currency,

              status:
                "success",

              senderId:
                lockedInvoice.recipientId,

              recipientId:
                lockedInvoice.requesterId,

              reference:
                `${transactionRef}-ESC`,

              externalReference:
                verification.providerReference,

              description:
                `Escrow funding for invoice ${lockedInvoice.id}`,

              isUserAccountTransfer:
                false,

              paymentMethod:
                "bank",

              paymentGateway:
                "SquadCo",

              provider:
                "SquadCo",

              providerReference:
                verification.providerReference,

              providerResponses:
                [verification.raw],

              metadata: {
                invoiceId:
                  lockedInvoice.id,

                rfqId:
                  quote.id,

                paymentReference:
                  transactionRef,

                isInternalEscrowOperation:
                  true,
              },
            },
            {
              transaction:
                transactionDb,
            }
          );

        // ========================================================
        // CREATE ESCROW
        // ========================================================

        escrow =
          await Escrow.create(
            {
              // Escrow ownership remains seller
              // (creator) -> buyer (recipient).

              creatorId:
                lockedInvoice.requesterId,

              recipientId:
                lockedInvoice.recipientId,

              amount:
                lockedInvoice.amount,

              currentBalance:
                lockedInvoice.amount,

              currency:
                lockedInvoice.currency,

              status:
                "FUNDED",

              escrowUprn,

              fundingTransactionId:
                escrowFundingTransaction.id,

              conditions:
                `Escrow for RFQ #${quote.quote_number}`,

              description:
                lockedInvoice.description,

              expiryDate,

              metadata: {
                quoteid:
                  quote.id.toString(),

                quote_number:
                  quote.quote_number,

                invoiceid:
                  lockedInvoice.id.toString(),

                paymentReference:
                  transactionRef,

                squadRef:
                  verification.providerReference,

                funded:
                  true,
              },
            },
            {
              transaction:
                transactionDb,
            }
          );
      }

      // ============================================================
      // UPDATE INVOICE TO PAID
      // ============================================================

      lockedInvoice.status =
        "paid";

      lockedInvoice.paymentStatus =
        "paid";

      lockedInvoice.squadRef =
        verification.providerReference;

      lockedInvoice.paidAt =
        lockedInvoice.paidAt ||
        new Date();

      lockedInvoice.verifiedAt =
        new Date();

      lockedInvoice.fundingTransactionId =
        invoiceTransaction.id;

      lockedInvoice.escrowFundingTransactionId =
        escrowFundingTransaction?.id ||
        lockedInvoice.escrowFundingTransactionId;

      lockedInvoice.escrowId =
        escrow.id;

      lockedInvoice.gatewayResponse =
        verification.raw;

      await lockedInvoice.save({
        transaction:
          transactionDb,
      });

      // ============================================================
      // COMMIT EVERYTHING
      // ============================================================

      await transactionDb.commit();

      // ============================================================
      // 🔔 NOTIFICATION: INVOICE PAID
      // ============================================================

      await createNotification({
        recipientId:
          lockedInvoice.requesterId,

        senderId:
          lockedInvoice.recipientId,

        title:
          "Invoice Paid",

        message:
          `Invoice ${
            lockedInvoice.invoice_number ||
            `#${lockedInvoice.id}`
          } has been paid successfully. ` +
          `The funds are now secured in escrow.`,

        type:
          "success",

        category:
          "invoice",

        metadata: {
          event:
            "invoice_paid",

          invoiceId:
            lockedInvoice.id,

          invoiceNumber:
            lockedInvoice.invoice_number,

          escrowId:
            escrow.id,

          escrowUprn:
            escrow.escrowUprn,

          amount:
            lockedInvoice.amount,

          currency:
            lockedInvoice.currency,

          paymentReference:
            transactionRef,

          providerReference:
            verification.providerReference,
        },
      });

      // ============================================================
      // 🔔 NOTIFICATION: ESCROW FUNDED
      // ============================================================

      await createNotification({
        recipientId:
          lockedInvoice.requesterId,

        senderId:
          lockedInvoice.recipientId,

        title:
          "Escrow Funded",

        message:
          `Your escrow of ${escrow.amount} ` +
          `${escrow.currency} has been funded ` +
          `and is now protecting the transaction.`,

        type:
          "success",

        category:
          "escrow",

        metadata: {
          event:
            "escrow_funded",

          escrowId:
            escrow.id,

          escrowUprn:
            escrow.escrowUprn,

          invoiceId:
            lockedInvoice.id,

          amount:
            escrow.amount,

          currency:
            escrow.currency,

          status:
            escrow.status,
        },
      });

      // ============================================================
      // RESPONSE
      // ============================================================

      return res.status(200).json({
        success: true,

        message:
          "Invoice payment verified and escrow funded",

        data: {
          invoice:
            lockedInvoice,

          escrow,

          transactions: {
            invoicePayment:
              invoiceTransaction,

            escrowFunding:
              escrowFundingTransaction,
          },
        },
      });
    } catch (error) {
      await transactionDb.rollback();
      throw error;
    }
  } catch (error) {
    console.error(
      "Invoice payment verification error:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,

      message:
        error.message ||
        "Failed to verify invoice payment",

      error:
        error.providerResponse ||
        error.message,
    });
  }
};

// ============================================================
// GET INVOICE BY ID
// ============================================================

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice =
      await Invoice.findByPk(
        req.params.invoiceId,
        {
          include: [
            {
              association: "rfq",
            },
            Escrow,
          ],
        }
      );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (
      String(invoice.requesterId) !==
        String(req.user.id) &&
      String(invoice.recipientId) !==
        String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to view this invoice",
      });
    }

    return res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoice",
      error: error.message,
    });
  }
};