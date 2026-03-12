const { body, validationResult } = require('express-validator');

// Validation middleware for creating an escrow
const validateEscrowCreation = [
  body('recipientId')
    .notEmpty()
    .withMessage('Recipient ID is required')
    .isMongoId()
    .withMessage('Invalid recipient ID format'),
  
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isNumeric()
    .withMessage('Amount must be a number')
    .custom((value) => {
      if (value <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      return true;
    }),
  
  body('currency')
    .notEmpty()
    .withMessage('Currency is required')
    .isString()
    .withMessage('Currency must be a string')
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter code'),
  
  body('conditions')
    .optional()
    .isString()
    .withMessage('Conditions must be a string')
    .trim()
    .isLength({ max: 500 })
    .withMessage('Conditions cannot exceed 500 characters'),
  
  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid expiry date format')
    .custom((value) => {
      const expiryDate = new Date(value);
      const now = new Date();
      if (expiryDate <= now) {
        throw new Error('Expiry date must be in the future');
      }
      return true;
    }),
  
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  // Middleware to check for validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

// Validation middleware for funding an escrow
const validateEscrowFunding = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isNumeric()
    .withMessage('Amount must be a number')
    .custom((value) => {
      if (value <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      return true;
    }),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

// Validation middleware for disputing an escrow
const validateEscrowDispute = [
  body('reason')
    .notEmpty()
    .withMessage('Dispute reason is required')
    .isString()
    .withMessage('Reason must be a string')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  validateEscrowCreation,
  validateEscrowFunding,
  validateEscrowDispute
}; 