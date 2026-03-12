const { check, validationResult } = require("express-validator");

const validateUser = [
  check("accountType")
    .isIn(["Personal", "Merchant"])
    .withMessage("Invalid account type"),

  check("email").isEmail().withMessage("Valid email required"),

  check("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  check("country").notEmpty().withMessage("Country is required"),

  // Personal validation
  check("firstName")
    .if(check("accountType").equals("Personal"))
    .notEmpty()
    .withMessage("First name required"),

  check("surname")
    .if(check("accountType").equals("Personal"))
    .notEmpty()
    .withMessage("Surname required"),

  check("phoneNumber")
    .if(check("accountType").equals("Personal"))
    .notEmpty()
    .withMessage("Phone number required"),

  // Merchant validation
  check("businessName")
    .if(check("accountType").equals("Merchant"))
    .notEmpty()
    .withMessage("Business name required"),

  check("industry")
    .if(check("accountType").equals("Merchant"))
    .notEmpty()
    .withMessage("Industry required"),

  check("companyAddress")
    .if(check("accountType").equals("Merchant"))
    .notEmpty()
    .withMessage("Company address required"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

module.exports = { validateUser };
