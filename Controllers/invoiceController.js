const mongoose = require("mongoose");

const Escrow = require("../models/Escrow");
const Invoice = require("../models/Invoice");
const Quote = require("../models/Quote");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const squadService = require("../services/squad.service");
const { generateUPRN } = require("../utils/paymentUtils");

const createInvoiceFromQuote = async (quote, session = null) => {
  const requesterId = quote.user?._id || quote.user;
  const recipientId = quote.destinatary_user?._id || quote.destinatary_user;
  console.log("STEP: before Invoice.findOne createInvoiceFromQuote", {
    quoteId: quote._id,
  });
  const existingInvoice = await Invoice.findOne({ rfqId: quote._id }).session(
    session,
  );
  console.log("STEP: after Invoice.findOne createInvoiceFromQuote", {
    quoteId: quote._id,
    invoiceFound: !!existingInvoice,
  });

  if (existingInvoice) {
    if (!quote.invoice) {
      quote.invoice = existingInvoice._id;
      console.log("STEP: before quote.save existing invoice createInvoiceFromQuote", {
        quoteId: quote._id,
        invoiceId: existingInvoice._id,
      });
      await quote.save({ session });
      console.log("STEP: after quote.save existing invoice createInvoiceFromQuote", {
        quoteId: quote._id,
        invoiceId: existingInvoice._id,
      });
    }
    return existingInvoice;
  }

  console.log("STEP: before Invoice.create createInvoiceFromQuote", {
    quoteId: quote._id,
  });
  const [invoice] = await Invoice.create(
    [
      {
        rfqId: quote._id,
        requesterId,
        recipientId,
        amount: Number(quote.total || quote.amount),
        currency: quote.currency || "NGN",
        description: quote.product_description,
        status: "pending",
        paymentStatus: "unpaid",
        metadata: {
          quoteNumber: quote.quote_number,
          productQuantity: quote.product_quantity,
        },
      },
    ],
    { session },
  );
  console.log("STEP: after Invoice.create createInvoiceFromQuote", {
    quoteId: quote._id,
    invoiceId: invoice?._id,
  });

  quote.invoice = invoice._id;
  console.log("STEP: before quote.save new invoice createInvoiceFromQuote", {
    quoteId: quote._id,
    invoiceId: invoice._id,
  });
  await quote.save({ session });
  console.log("STEP: after quote.save new invoice createInvoiceFromQuote", {
    quoteId: quote._id,
    invoiceId: invoice._id,
  });

  return invoice;
};

const amountsMatch = (providerAmount, invoiceAmount) => {
  const gatewayAmount = Number(String(providerAmount).replace(/,/g, ""));
  const expectedAmount = Number(String(invoiceAmount).replace(/,/g, ""));

  if (!Number.isFinite(gatewayAmount) || !Number.isFinite(expectedAmount)) {
    return false;
  }

  return (
    Math.abs(gatewayAmount - expectedAmount) < 0.01 ||
    Math.abs(gatewayAmount / 100 - expectedAmount) < 0.01
  );
};

exports.createInvoiceFromQuote = createInvoiceFromQuote;

exports.initiateInvoicePayment = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (invoice.requesterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the invoice requester can pay this invoice",
      });
    }

    if (invoice.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Invoice has already been paid",
      });
    }

    const requester = await User.findById(invoice.requesterId);
    if (!requester) {
      return res.status(404).json({
        success: false,
        message: "Invoice requester not found",
      });
    }

    const paymentReference =
      invoice.paymentReference ||
      `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const callbackUrl = `${process.env.FRONTEND_URL || "http://localhost:8081"}/api/invoices/callback`;

    const payment = await squadService.initiateCollection({
      amount: invoice.amount,
      email: requester.email,
      currency: invoice.currency,
      transactionRef: paymentReference,
      callbackUrl,
      metadata: {
        invoiceId: invoice._id.toString(),
        rfqId: invoice.rfqId.toString(),
        paymentType: "invoice",
      },
    });

    invoice.paymentReference = paymentReference;
    invoice.checkoutUrl = payment.checkoutUrl;
    invoice.paymentStatus = "pending";
    invoice.gatewayResponse = payment.raw;
    await invoice.save();

    return res.status(200).json({
      success: true,
      paymentUrl: payment.checkoutUrl,
      reference: paymentReference,
    });
  } catch (error) {
    console.error("Invoice payment initiation error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to initiate invoice payment",
      error: error.providerResponse || error.message,
    });
  }
};

exports.verifyInvoicePayment = async (req, res) => {
  try {
    const transactionRef =
      req.body.transactionRef || req.body.reference || req.body.paymentReference;

    if (!transactionRef) {
      return res.status(400).json({
        success: false,
        message: "Transaction reference is required",
      });
    }

    const invoice = await Invoice.findOne({ paymentReference: transactionRef });
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice payment reference not found",
      });
    }

    if (invoice.paymentStatus === "paid") {
      const escrow = invoice.escrowId
        ? await Escrow.findById(invoice.escrowId)
        : null;
      return res.status(200).json({
        success: true,
        message: "Invoice payment already verified",
        data: { invoice, escrow },
      });
    }

    const verification = await squadService.verifyCollection(transactionRef);
    invoice.gatewayResponse = verification.raw;

    if (verification.status !== "success") {
      invoice.paymentStatus = "failed";
      await invoice.save();

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
        data: verification.raw,
      });
    }

    if (!amountsMatch(verification.amount, invoice.amount)) {
      invoice.paymentStatus = "failed";
      await invoice.save();

      return res.status(400).json({
        success: false,
        message: "Payment amount does not match invoice amount",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const lockedInvoice = await Invoice.findById(invoice._id).session(session);
      if (lockedInvoice.paymentStatus === "paid") {
        await session.commitTransaction();
        session.endSession();
        return res.status(200).json({
          success: true,
          message: "Invoice payment already verified",
          data: { invoice: lockedInvoice },
        });
      }

      const quote = await Quote.findById(lockedInvoice.rfqId).session(session);
      if (!quote) {
        const error = new Error("RFQ not found for invoice");
        error.statusCode = 404;
        throw error;
      }

      let invoiceTransaction = await Transaction.findOne({
        reference: transactionRef,
      }).session(session);

      if (!invoiceTransaction) {
        invoiceTransaction = new Transaction({
          type: "invoice_payment",
          amount: lockedInvoice.amount,
          currency: lockedInvoice.currency,
          status: "success",
          senderId: lockedInvoice.requesterId,
          recipientId: lockedInvoice.recipientId,
          reference: transactionRef,
          externalReference: verification.providerReference,
          description: `Invoice payment for RFQ #${quote.quote_number}`,
          isUserAccountTransfer: false,
          paymentMethod: "bank",
          paymentGateway: "SquadCo",
          provider: "SquadCo",
          providerReference: verification.providerReference,
          providerResponses: [verification.raw],
          metadata: {
            invoiceId: lockedInvoice._id,
            rfqId: quote._id,
            quoteNumber: quote.quote_number,
          },
        });
        await invoiceTransaction.save({ session });
      }

      let escrow = await Escrow.findOne({
        "metadata.invoice_id": lockedInvoice._id.toString(),
      }).session(session);

      let escrowFundingTransaction = lockedInvoice.escrowFundingTransactionId
        ? await Transaction.findById(
            lockedInvoice.escrowFundingTransactionId,
          ).session(session)
        : null;

      if (!escrow) {
        const escrowUprn = generateUPRN(
          lockedInvoice.requesterId,
          "escrow_release",
        );
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        escrowFundingTransaction = new Transaction({
          type: "escrow_funding",
          amount: lockedInvoice.amount,
          currency: lockedInvoice.currency,
          status: "success",
          senderId: lockedInvoice.requesterId,
          recipientId: lockedInvoice.recipientId,
          reference: `${transactionRef}-ESC`,
          externalReference: verification.providerReference,
          description: `Escrow funding for invoice ${lockedInvoice._id}`,
          isUserAccountTransfer: false,
          paymentMethod: "bank",
          paymentGateway: "SquadCo",
          provider: "SquadCo",
          providerReference: verification.providerReference,
          providerResponses: [verification.raw],
          metadata: {
            invoiceId: lockedInvoice._id,
            rfqId: quote._id,
            paymentReference: transactionRef,
            isInternalEscrowOperation: true,
          },
        });
        await escrowFundingTransaction.save({ session });

        escrow = new Escrow({
          creatorId: lockedInvoice.requesterId,
          recipientId: lockedInvoice.recipientId,
          amount: lockedInvoice.amount,
          currentBalance: lockedInvoice.amount,
          currency: lockedInvoice.currency,
          status: "FUNDED",
          escrowUprn,
          fundingTransactionId: escrowFundingTransaction._id,
          conditions: `Escrow for RFQ #${quote.quote_number}`,
          description: lockedInvoice.description,
          expiryDate,
          metadata: {
            quote_id: quote._id.toString(),
            quote_number: quote.quote_number,
            invoice_id: lockedInvoice._id.toString(),
            paymentReference: transactionRef,
            squadRef: verification.providerReference,
            funded: true,
          },
        });
        await escrow.save({ session });
      }

      lockedInvoice.status = "paid";
      lockedInvoice.paymentStatus = "paid";
      lockedInvoice.squadRef = verification.providerReference;
      lockedInvoice.paidAt = lockedInvoice.paidAt || new Date();
      lockedInvoice.verifiedAt = new Date();
      lockedInvoice.fundingTransactionId = invoiceTransaction._id;
      lockedInvoice.escrowFundingTransactionId =
        escrowFundingTransaction?._id || lockedInvoice.escrowFundingTransactionId;
      lockedInvoice.escrowId = escrow._id;
      lockedInvoice.gatewayResponse = verification.raw;
      await lockedInvoice.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: "Invoice payment verified and escrow funded",
        data: {
          invoice: lockedInvoice,
          escrow,
          transactions: {
            invoicePayment: invoiceTransaction,
            escrowFunding: escrowFundingTransaction,
          },
        },
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error("Invoice payment verification error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to verify invoice payment",
      error: error.providerResponse || error.message,
    });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId)
      .populate("rfqId")
      .populate("escrowId");

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
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
