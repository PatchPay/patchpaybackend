const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define a bank account schema for reuse
const bankAccountSchema = new Schema({
  bankName: {
    type: String,
    required: true
  },
  accountNumber: {
    type: String,
    required: true
  }
}, { _id: false });

// Define a contact schema for reuse with Merchant, NGO, and Government accounts
const contactSchema = new Schema({
  contactName: {
    type: String,
    required: true
  },
  contactRole: {
    type: String,
    required: true
  },
  contactPhone: {
    type: String,
    required: true
  },
  contactEmail: {
    type: String,
    required: true
  }
}, { _id: false });

// Define an address schema for reuse
const addressSchema = new Schema({
  street: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  postal_code: {
    type: String,
    required: true
  }
}, { _id: false });

const userSchema = new Schema({
  // Common fields for all account types
  accountType: {
    type: String,
    enum: ['Personal', 'Government', 'Merchant', 'NGO'],
    required: true
  },
  status_client: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Inactive'
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  countryCode: {
    type: String,
    required: true
  },
  callingCode: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  continent: {
    type: String,
    required: false
  },
  currency: {
    type: String,
    required: true,
    default: 'GBP'
  },
  // Common financial fields
  bankName: {
    type: String,
    required: true,
    default: ''
  },
  bankAccount: {
    type: String,
    required: true,
    default: ''
  },
  additionalBankAccounts: {
    type: [bankAccountSchema],
    default: [],
    validate: [arrayLimit, '{PATH} exceeds the limit of 2']
  },
  // Transaction information
  transactionRole: {
    type: String,
    enum: ['buyer', 'seller', 'both'],
    default: 'both'
  },
  transactionRate: {
    type: String,
    required: false
  },
  // System fields
  notification: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  token: {
    type: String,
    default: ''
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: ''
  },
  // Add reset password fields
  resetPasswordToken: {
    type: String,
    default: ''
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },

  // -------- Personal account specific fields --------
  firstName: {
    type: String,
    required: function() {
      return this.accountType === 'Personal' || this.accountType === 'Government';
    }
  },
  middleName: {
    type: String,
    required: false
  },
  surname: {
    type: String,
    required: function() {
      return this.accountType === 'Personal' || this.accountType === 'Government';
    }
  },
  dateOfBirth: {
    type: Date,
    required: function() {
      return this.accountType === 'Personal';
    }
  },
  address: {
    type: addressSchema,
    required: function() {
      return this.accountType === 'Personal';
    }
  },
  optionalAddress: {
    type: addressSchema,
    required: false
  },
  exchangeRate: {
    type: String,
    required: false
  },
  bankCharges: {
    type: String,
    required: false
  },

  // -------- NGO account specific fields --------
  organizationName: {
    type: String,
    required: function() {
      return this.accountType === 'NGO';
    }
  },
  registrationNumber: {
    type: String,
    required: function() {
      return this.accountType === 'NGO' || this.accountType === 'Government' || this.accountType === 'Merchant';
    }
  },
  officeAddress: {
    type: String,
    required: function() {
      return this.accountType === 'NGO';
    }
  },
  contacts: {
    type: [contactSchema],
    required: function() {
      return this.accountType === 'NGO' || this.accountType === 'Government' || this.accountType === 'Merchant';
    },
    validate: [arrayLimit, '{PATH} exceeds the limit of 3']
  },

  // -------- Merchant account specific fields --------
  businessName: {
    type: String,
    required: function() {
      return this.accountType === 'Merchant';
    }
  },
  companyRegistrationNumber: {
    type: String,
    required: function() {
      return this.accountType === 'Merchant';
    }
  },
  companyAddress: {
    type: String,
    required: function() {
      return this.accountType === 'Merchant';
    }
  },

  // -------- Government account specific fields --------
  departmentName: {
    type: String,
    required: function() {
      return this.accountType === 'Government';
    }
  },
  officialAddress: {
    type: String,
    required: function() {
      return this.accountType === 'Government';
    }
  }
});

// Validation function to limit array length
function arrayLimit(val) {
  return val.length <= 3; // Allow up to 3 (main + 2 additional)
}

// Pre-save middleware to update the 'updatedAt' field
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create model
const User = mongoose.model('User', userSchema);

// Ensure only email has a unique index and phoneNumber does not
User.collection.dropIndex('phoneNumber_1')
  .then(() => console.log('Dropped unique index on phoneNumber'))
  .catch(err => {
    if (err.code === 27) {
      console.log('Index not found, no need to drop');
    } else {
      console.error('Error dropping index:', err);
    }
  });

module.exports = User;
