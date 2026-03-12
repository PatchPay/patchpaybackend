const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');  // The user model
const Wallet = require('../models/Wallet'); // Add the Wallet model
const { generateAccountNumber } = require('../utils/accountUtils'); // Add utility for generating account numbers

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if the account is inactive
    if (user.status_client === 'Inactive') {
      return res.status(403).json({
        message: 'Account Inactive, please verify account or contact customer services.',
        accountInactive: true
      });
    }

    // Check if the user has a wallet, create one if not
    const existingWallet = await Wallet.findOne({ userId: user._id });
    if (!existingWallet) {
      console.log(`User ${user._id} doesn't have a wallet, creating one...`);
      
      // CHANGE: Get user data from database to determine proper currency
      const userData = await User.findById(user._id);
      if (!userData.country || !userData.countryCode) {
        return res.status(400).json({ 
          message: 'Cannot initialize wallet: Your profile is missing country information. Please update your profile.' 
        });
      }
      
      // Generate account number using country code
      const accountNumber = generateAccountNumber(userData.countryCode, 'personal');
      
      // CHANGE: Determine currency based on user's country data
      let currency;
      try {
        // Import the getCurrencyForUser function
        const { getCurrencyForUser } = require('../utils/transactionFeeUtils');
        
        // Determine currency based on user data
        currency = getCurrencyForUser(userData);
        console.log(`Determined currency ${currency} for user based on country: ${userData.country} (${userData.countryCode})`);
      } catch (currencyError) {
        console.error(`Error determining currency: ${currencyError.message}`);
        return res.status(400).json({ 
          message: `Cannot initialize wallet: ${currencyError.message}. Please update your profile with a valid country.`
        });
      }
      
      // Create new wallet with proper currency from user data
      const wallet = new Wallet({
        userId: user._id,
        accountNumber,
        balance: 0,
        currency, // Use determined currency instead of hardcoded 'NGN'
        isActive: true,
        accountType: 'personal'
      });
      
      await wallet.save();
      console.log(`Wallet created for user ${user._id} with account number ${accountNumber} and currency ${currency}`);
    } else {
      // Check if existing wallet has accountType field, add it if missing
      if (!existingWallet.accountType) {
        console.log('Adding missing accountType field to existing wallet');
        existingWallet.accountType = 'personal';
        await existingWallet.save();
        console.log('Updated wallet with accountType field');
      }
    }

    // Generate token with 2-hour expiration
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'patchpay-secret-key-7d9ac52e',
      { expiresIn: '2h' }
    );

    // Calculate token expiry (2 hours from now)
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 2);

    // Return user data and token
    res.json({
      success: true,
      data: {
        token,
        tokenExpiry,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          uniqueId: user.uniqueId,
          status: user.status
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in'
    });
  }
};

const registerUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate unique ID
    const uniqueId = Math.random().toString(36).substr(2, 9).toUpperCase();

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phoneNumber,
      uniqueId,
      status: 'Active'
    });

    await user.save();

    // Generate token with 2-hour expiration
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'patchpay-secret-key-7d9ac52e',
      { expiresIn: '2h' }
    );

    // Calculate token expiry (2 hours from now)
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 2);

    // Return user data and token
    res.status(201).json({
      success: true,
      data: {
        token,
        tokenExpiry,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          uniqueId: user.uniqueId,
          status: user.status
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user'
    });
  }
};

module.exports = {
  loginUser,
  registerUser
};
