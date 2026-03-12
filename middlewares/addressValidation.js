import { body, validationResult } from 'express-validator';

// Middleware to validate address fields
export const validateAddress = [
  body('user').notEmpty().withMessage('User is required'),  // Ensure the user field is provided
  body('addresses').isArray().withMessage('Addresses should be an array'),  // Ensure addresses is an array
  body('addresses.*.street').notEmpty().withMessage('Street is required'),  // Ensure street is provided
  body('addresses.*.city').notEmpty().withMessage('City is required'),  // Ensure city is provided
  body('addresses.*.postal_code').notEmpty().withMessage('Postal code is required'),  // Ensure postal code is provided
  body('addresses.*.country').notEmpty().withMessage('Country is required'),  // Ensure country is provided

  // Handle validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();  // If validation passed, proceed to the next middleware (controller)
  }
];
