const fs = require('fs');
const path = require('path');

// Function to create controllers with actual content
function setupControllers() {
  const controllers = {
    userController: `const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../services/emailService');

const registerUser = async (req, res) => {
  try {
    const { email, password, ...otherFields } = req.body;
    
    // Check if email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const userData = {
      email,
      password: hashedPassword,
      ...otherFields,
      status_client: 'Inactive',
      emailVerified: false,
      emailVerificationToken: crypto.randomBytes(32).toString('hex')
    };

    const newUser = new User(userData);
    await newUser.save();

    // Send verification email
    try {
      await emailService.sendVerificationEmail(email, userData.emailVerificationToken);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
    }

    const userResponse = newUser.toObject();
    delete userResponse.password;
    
    res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      user: userResponse
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({ token, user: userResponse });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token, email } = req.query;

    const user = await User.findOne({
      email,
      emailVerificationToken: token,
      emailVerified: false
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid verification link' });
    }

    user.emailVerified = true;
    user.status_client = 'Active';
    user.emailVerificationToken = '';
    await user.save();

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ message: 'Error verifying email' });
  }
};

const logout = async (req, res) => {
  try {
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ message: 'Error logging out' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json(userResponse);
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ message: 'Error getting user profile' });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const allowedUpdates = ['firstName', 'lastName', 'phoneNumber', 'address'];
    Object.keys(req.body).forEach(update => {
      if (allowedUpdates.includes(update)) {
        user[update] = req.body[update];
      }
    });

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json(userResponse);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Error updating user profile' });
  }
};

const walletController: `const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const mongoose = require('mongoose');
const { generateAccountNumber, formatAmount } = require('../utils/accountUtils');
const { calculateTransactionFee } = require('../utils/transactionFeeUtils');

const initializeWallet = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let wallet = await Wallet.findOne({ userId });
    
    if (wallet) {
      return res.status(200).json({ 
        success: true, 
        message: 'Wallet already initialized',
        data: {
          accountNumber: wallet.accountNumber,
          balance: wallet.balance,
          currency: wallet.currency
        }
      });
    }

    const accountNumber = generateAccountNumber(user.countryCode);
    
    wallet = new Wallet({
      userId,
      accountNumber,
      balance: 0,
      currency: 'GBP',
      isActive: true
    });

    await wallet.save();

    return res.status(201).json({
      success: true,
      message: 'Wallet initialized successfully',
      data: {
        accountNumber: wallet.accountNumber,
        balance: wallet.balance,
        currency: wallet.currency
      }
    });
  } catch (error) {
    console.error('Error initializing wallet:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize wallet'
    });
  }
};

const getBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        balance: wallet.balance,
        currency: wallet.currency
      }
    });
  } catch (error) {
    console.error('Error getting balance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get balance'
    });
  }
};

const getWalletDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const wallet = await Wallet.findOne({ userId }).populate('userId', 'firstName lastName email');
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        accountNumber: wallet.accountNumber,
        balance: wallet.balance,
        currency: wallet.currency,
        isActive: wallet.isActive,
        user: {
          name: \`\${wallet.userId.firstName} \${wallet.userId.lastName}\`,
          email: wallet.userId.email
        }
      }
    });
  } catch (error) {
    console.error('Error getting wallet details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get wallet details'
    });
  }
};

const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const transactions = await Transaction.find({
      $or: [{ senderId: userId }, { recipientId: userId }]
    })
    .sort({ createdAt: -1 })
    .populate('senderId', 'firstName lastName')
    .populate('recipientId', 'firstName lastName');
    
    return res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error getting transaction history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get transaction history'
    });
  }
};

const transferFunds = async (req, res) => {
  try {
    const { recipientAccountNumber, amount } = req.body;
    const userId = req.user.id;

    const sourceWallet = await Wallet.findOne({ userId });
    const destinationWallet = await Wallet.findOne({ accountNumber: recipientAccountNumber });

    if (!sourceWallet || !destinationWallet) {
      return res.status(404).json({
        success: false,
        message: 'Invalid source or destination wallet'
      });
    }

    if (sourceWallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient funds'
      });
    }

    const fee = calculateTransactionFee(amount);
    const totalAmount = amount + fee;

    sourceWallet.balance -= totalAmount;
    destinationWallet.balance += amount;

    await sourceWallet.save();
    await destinationWallet.save();

    const transaction = new Transaction({
      senderId: userId,
      recipientId: destinationWallet.userId,
      amount,
      fee,
      type: 'transfer',
      status: 'completed'
    });

    await transaction.save();

    return res.status(200).json({
      success: true,
      message: 'Transfer successful',
      data: {
        amount,
        fee,
        remainingBalance: sourceWallet.balance
      }
    });
  } catch (error) {
    console.error('Error processing transfer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process transfer'
    });
  }
};

const calculateFee = async (req, res) => {
  try {
    const { amount } = req.body;
    const fee = calculateTransactionFee(amount);
    
    return res.status(200).json({
      success: true,
      data: {
        amount,
        fee,
        total: amount + fee
      }
    });
  } catch (error) {
    console.error('Error calculating fee:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate fee'
    });
  }
};

const verifyAccount = async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const wallet = await Wallet.findOne({ accountNumber })
      .populate('userId', 'firstName lastName email');
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        accountNumber: wallet.accountNumber,
        accountHolder: \`\${wallet.userId.firstName} \${wallet.userId.lastName}\`,
        email: wallet.userId.email
      }
    });
  } catch (error) {
    console.error('Error verifying account:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify account'
    });
  }
};

const depositFunds = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;
    
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    wallet.balance += amount;
    await wallet.save();

    const transaction = new Transaction({
      recipientId: userId,
      amount,
      type: 'deposit',
      status: 'completed'
    });

    await transaction.save();

    return res.status(200).json({
      success: true,
      message: 'Deposit successful',
      data: {
        amount,
        newBalance: wallet.balance
      }
    });
  } catch (error) {
    console.error('Error processing deposit:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process deposit'
    });
  }
};

module.exports = {
  initializeWallet,
  getBalance,
  getWalletDetails,
  getTransactionHistory,
  transferFunds,
  calculateFee,
  verifyAccount,
  depositFunds
};`,

    // Add other controllers here as needed
  };

  try {
    const controllersDir = path.join(__dirname, 'controllers');

    // Create controllers directory if it doesn't exist
    if (!fs.existsSync(controllersDir)) {
      fs.mkdirSync(controllersDir, { recursive: true });
      console.log('Created controllers directory');
    }

    // Write each controller file
    for (const [filename, content] of Object.entries(controllers)) {
      const filePath = path.join(controllersDir, `${filename}.js`);
      fs.writeFileSync(filePath, content, 'utf8');
      
      // Verify the file was written correctly
      const writtenContent = fs.readFileSync(filePath, 'utf8');
      if (writtenContent.length === 0) {
        throw new Error(`File was created but is empty: ${filename}.js`);
      }
      console.log(`Successfully wrote ${writtenContent.length} bytes to ${filename}.js`);
    }

    console.log('All controllers set up successfully');
  } catch (error) {
    console.error('Error setting up controllers:', error);
    process.exit(1); // Exit with error if we can't set up the controllers
  }
}

// Run the setup
setupControllers(); 