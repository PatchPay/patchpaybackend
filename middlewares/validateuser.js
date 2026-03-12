const { check, validationResult } = require('express-validator');

const validateUser = [
  // Common validation rules for all account types
  check('accountType')
    .isIn(['Personal', 'NGO', 'Merchant', 'Government'])
    .withMessage('Invalid account type'),
  
  check('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  check('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  check('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required'),
  
  check('countryCode')
    .notEmpty()
    .withMessage('Country code is required'),
  
  check('callingCode')
    .notEmpty()
    .withMessage('Calling code is required'),
  
  check('state')
    .notEmpty()
    .withMessage('State is required'),
  
  check('country')
    .notEmpty()
    .withMessage('Country is required'),
  
  // Banking information validation
  check('bankName')
    .notEmpty()
    .withMessage('Bank name is required'),
  
  check('bankAccount')
    .notEmpty()
    .withMessage('Bank account is required'),
  
  // Transaction validation removed - will be in separate model
  
  // Conditional validation based on account type
  (req, res, next) => {
    // Add account-type specific validations
    if (req.body.accountType === 'Personal') {
      validatePersonalAccount(req);
    } else if (req.body.accountType === 'NGO') {
      validateNGOAccount(req);
    } else if (req.body.accountType === 'Merchant') {
      validateMerchantAccount(req);
    } else if (req.body.accountType === 'Government') {
      validateGovernmentAccount(req);
    }
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    next();
  }
];

// Validate Personal account specific fields
function validatePersonalAccount(req) {
  check('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .run(req);
  
  check('surname')
    .notEmpty()
    .withMessage('Surname is required')
    .run(req);
  
  check('dateOfBirth')
    .notEmpty()
    .withMessage('Date of birth is required')
    .run(req);
  
  check('address')
    .notEmpty()
    .withMessage('Address is required')
    .run(req);
}

// Validate NGO account specific fields
function validateNGOAccount(req) {
  check('organizationName')
    .notEmpty()
    .withMessage('Organization name is required')
    .run(req);
  
  check('registrationNumber')
    .notEmpty()
    .withMessage('Registration number is required')
    .run(req);
  
  check('officeAddress')
    .notEmpty()
    .withMessage('Office address is required')
    .run(req);
  
  check('contactPerson.name')
    .notEmpty()
    .withMessage('Contact person name is required')
    .run(req);
  
  check('contactPerson.role')
    .notEmpty()
    .withMessage('Contact person role is required')
    .run(req);
}

// Validate Merchant account specific fields
function validateMerchantAccount(req) {
  check('businessName')
    .notEmpty()
    .withMessage('Business name is required')
    .run(req);
  
  check('companyRegistrationNumber')
    .notEmpty()
    .withMessage('Company registration number is required')
    .run(req);
  
  check('companyAddress')
    .notEmpty()
    .withMessage('Company address is required')
    .run(req);
  
  check('contactPerson.name')
    .notEmpty()
    .withMessage('Contact person name is required')
    .run(req);
  
  check('contactPerson.role')
    .notEmpty()
    .withMessage('Contact person role is required')
    .run(req);
}

// Validate Government account specific fields
function validateGovernmentAccount(req) {
  check('departmentName')
    .notEmpty()
    .withMessage('Department name is required')
    .run(req);
  
  check('agencyCode')
    .notEmpty()
    .withMessage('Agency code is required')
    .run(req);
  
  check('officialAddress')
    .notEmpty()
    .withMessage('Official address is required')
    .run(req);
  
  check('contactPerson.name')
    .notEmpty()
    .withMessage('Contact person name is required')
    .run(req);
  
  check('contactPerson.role')
    .notEmpty()
    .withMessage('Contact person role is required')
    .run(req);
}

// Specific personal account validation middleware
const validatePersonalRegistration = [
  // Only validate these fields for personal accounts
  check('accountType')
    .isIn(['Personal'])
    .withMessage('Invalid account type. Must be Personal'),

  check('firstName').notEmpty().withMessage('First name is required'),
  check('surname').notEmpty().withMessage('Surname is required'),
  check('dateOfBirth').notEmpty().withMessage('Date of birth is required'),
  check('email').isEmail().withMessage('Invalid email address'),
  check('phoneNumber').notEmpty().withMessage('Phone number is required'),
  check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  check('countryCode').notEmpty().withMessage('Country code is required'),
  check('callingCode').notEmpty().withMessage('Calling code is required'),
  check('state').notEmpty().withMessage('State is required'),
  check('country').notEmpty().withMessage('Country is required'),
  check('address').notEmpty().withMessage('Address is required'),
  check('bankName').notEmpty().withMessage('Bank name is required'),
  check('bankAccount').notEmpty().withMessage('Bank account is required'),
  
  // Transaction Role Validation removed - will be in separate model

  // Additional bank accounts if provided
  check('additionalBankAccounts.*.bankName')
    .if(check('additionalBankAccounts').exists())
    .notEmpty().withMessage('Bank name is required for additional accounts'),

  check('additionalBankAccounts.*.accountNumber')
    .if(check('additionalBankAccounts').exists())
    .notEmpty().withMessage('Account number is required for additional accounts'),

  // Middleware to Handle Validation Errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }
    next();
  }
];

module.exports = { validateUser, validatePersonalRegistration };
