const Escrow = require("../models/Escrow");

// Validate escrow creation request
const validateEscrowCreation = (req, res, next) => {
  const { quoteid } = req.body;

  if (!quoteid) {
    return res.status(400).json({
      success: false,
      message: "Quote ID is required",
    });
  }

  next();
};

// Check if user has permission to access escrow
const checkEscrowPermission = async (req, res, next) => {
  try {
    const escrow = await Escrow.findByPk(req.params.id);

    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: "Escrow not found",
      });
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user ID not found",
      });
    }

    const creatorId = escrow.creatorId;
    const recipientId = escrow.recipientId;

    const isCreator =
      creatorId != null && String(creatorId) === String(userId);

    const isRecipient =
      recipientId != null && String(recipientId) === String(userId);

    if (!isCreator && !isRecipient) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this escrow",
      });
    }

    // Make escrow available to following middleware/controller
    req.escrow = escrow;

    next();
  } catch (error) {
    console.error("Error checking escrow permission:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check escrow permission",
    });
  }
};

// Check if user can perform action on escrow
const checkEscrowAction = (actionType) => {
  return async (req, res, next) => {
    try {
      const escrow = req.escrow;
      const userId = req.user?.id;

      if (!escrow) {
        return res.status(404).json({
          success: false,
          message: "Escrow not found",
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authenticated user ID not found",
        });
      }

      const isCreator =
        escrow.creatorId != null &&
        String(escrow.creatorId) === String(userId);

      const isRecipient =
        escrow.recipientId != null &&
        String(escrow.recipientId) === String(userId);

      switch (actionType) {
        case "fund":
          // Only creator can fund
          if (!isCreator) {
            return res.status(403).json({
              success: false,
              message: "Only the creator can fund the escrow",
            });
          }

          if (escrow.status !== "CREATED") {
            return res.status(400).json({
              success: false,
              message: "Escrow cannot be funded in its current state",
            });
          }

          break;

        case "deliver":
          // Only the recipient (seller) can submit delivery proof
          if (!isRecipient) {
            return res.status(403).json({
              success: false,
              message: "Only the seller can submit delivery proof",
            });
          }

          if (escrow.status !== "FUNDED") {
            return res.status(400).json({
              success: false,
              message: "Delivery proof can only be submitted for a funded escrow",
            });
          }

          break;

        case "confirm-receipt":
          // Only the creator (buyer) can confirm receipt
          if (!isCreator) {
            return res.status(403).json({
              success: false,
              message: "Only the buyer can confirm receipt",
            });
          }

          if (escrow.status !== "DELIVERED") {
            return res.status(400).json({
              success: false,
              message: "Receipt can only be confirmed after the seller marks the escrow as delivered",
            });
          }

          if (!escrow.deliveryProofUrl || !escrow.sellerDeliveredAt) {
            return res.status(400).json({
              success: false,
              message: "Delivery proof has not been submitted by the seller",
            });
          }

          break;

        case "release":
          // Only creator can release
          if (!isCreator) {
            return res.status(403).json({
              success: false,
              message: "Only the creator can release the escrow",
            });
          }

          if (escrow.status !== "FUNDED" && escrow.status !== "DELIVERED") {
            return res.status(400).json({
              success: false,
              message: "Escrow cannot be released in its current state",
            });
          }

          break;

        case "refund":
          // Only creator can refund
          if (!isCreator) {
            return res.status(403).json({
              success: false,
              message: "Only the creator can refund the escrow",
            });
          }

          if (escrow.status !== "FUNDED") {
            return res.status(400).json({
              success: false,
              message: "Escrow cannot be refunded in its current state",
            });
          }

          break;

        case "dispute":
          // Both creator and recipient can dispute
          if (!isCreator && !isRecipient) {
            return res.status(403).json({
              success: false,
              message: "Only the creator or recipient can dispute the escrow",
            });
          }

          if (escrow.status !== "FUNDED" && escrow.status !== "DELIVERED") {
            return res.status(400).json({
              success: false,
              message: "Escrow cannot be disputed in its current state",
            });
          }

          break;

        case "cancel":
          // Only creator can cancel
          if (!isCreator) {
            return res.status(403).json({
              success: false,
              message: "Only the creator can cancel the escrow",
            });
          }

          if (escrow.status !== "CREATED") {
            return res.status(400).json({
              success: false,
              message: "Escrow cannot be cancelled in its current state",
            });
          }

          break;

        default:
          return res.status(400).json({
            success: false,
            message: "Invalid action type",
          });
      }

      next();
    } catch (error) {
      console.error("Error checking escrow action permission:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to check escrow action permission",
      });
    }
  };
};

module.exports = {
  validateEscrowCreation,
  checkEscrowPermission,
  checkEscrowAction,
};