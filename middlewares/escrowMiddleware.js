const { ApiError } = require('../utils/ApiError');
const Escrow = require('../models/Escrow');

// Validate escrow creation request
const validateEscrowCreation = (req, res, next) => {
  const { quote_id } = req.body;

  // Check required fields
  if (!quote_id) {
    return res.status(400).json({
      success: false,
      message: 'Quote ID is required'
    });
  }

  next();
};

// Check if user has permission to access escrow
const checkEscrowPermission = async (req, res, next) => {
  try {
    const escrow = await Escrow.findById(req.params.id);
    
    if (!escrow) {
      return res.status(404).json({
        success: false,
        message: 'Escrow not found'
      });
    }

    const userId = req.user._id;
    
    // Check if user is either creator or recipient
    if (escrow.creatorId.toString() !== userId.toString() && 
        escrow.recipientId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this escrow'
      });
    }

    // Attach escrow to request for use in controller
    req.escrow = escrow;
    next();
  } catch (error) {
    console.error('Error checking escrow permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check escrow permission'
    });
  }
};

// Check if user can perform action on escrow
const checkEscrowAction = (actionType) => {
  return async (req, res, next) => {
    const escrow = req.escrow;
    const userId = req.user._id;

    switch (actionType) {
      case 'fund':
        // Only creator can fund
        if (escrow.creatorId.toString() !== userId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Only the creator can fund the escrow'
          });
        }
        if (escrow.status !== 'created') {
          return res.status(400).json({
            success: false,
            message: 'Escrow cannot be funded in its current state'
          });
        }
        break;

      case 'release':
        // Only creator can release
        if (escrow.creatorId.toString() !== userId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Only the creator can release the escrow'
          });
        }
        if (escrow.status !== 'funded') {
          return res.status(400).json({
            success: false,
            message: 'Escrow cannot be released in its current state'
          });
        }
        break;

      case 'refund':
        // Only creator can refund
        if (escrow.creatorId.toString() !== userId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Only the creator can refund the escrow'
          });
        }
        if (escrow.status !== 'funded') {
          return res.status(400).json({
            success: false,
            message: 'Escrow cannot be refunded in its current state'
          });
        }
        break;

      case 'dispute':
        // Both creator and recipient can dispute
        if (escrow.status !== 'funded') {
          return res.status(400).json({
            success: false,
            message: 'Escrow cannot be disputed in its current state'
          });
        }
        break;

      case 'cancel':
        // Only creator can cancel
        if (escrow.creatorId.toString() !== userId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Only the creator can cancel the escrow'
          });
        }
        if (escrow.status !== 'created') {
          return res.status(400).json({
            success: false,
            message: 'Escrow cannot be cancelled in its current state'
          });
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action type'
        });
    }

    next();
  };
};

// Export the middleware functions
module.exports = {
  validateEscrowCreation,
  checkEscrowPermission,
  checkEscrowAction
}; 