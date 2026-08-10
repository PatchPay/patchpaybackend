const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Op } = require("sequelize");
const emailService = require("../services/emailService");
const Wallet = require("../models/Wallet");
const { generateAccountNumber } = require("../utils/accountUtils");




const registerUser = async (req, res) => {
  try {
    console.log("📩 Registering new user:", {
      ...req.body,
      password: "[REDACTED]",
    });

    const { email } = req.body;

    const {
      firstName,
      middleName,
      surname,
      phoneNumber,
      password,
      accountType,
      country,
      countryCode,
      businessName,
      industry,
      companyAddress,
    } = req.body;

    // Check if email exists
    const existingUser = await User.findOne({
       where: {
        email,
    },
    });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Validate password
    if (!password || password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long",
      });
    }

    if (!country || !countryCode) {
      return res.status(400).json({
        message: "country and countryCode are required",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔥 Generate OTP
    const { generateOTP, sendOTPEmail } = require("../services/emailService");
    const otp = generateOTP();

    let userData = {
      email,
      password: hashedPassword,
      accountType,
      country,
      countryCode,
      emailVerified: false,
      status_client: "Inactive",

      // ✅ OTP fields
      otp,
      otpExpires: Date.now() + 10 * 60 * 1000, // 10 mins
    };

    // PERSONAL ACCOUNT
    if (accountType === "Personal") {
      if (!firstName || !surname || !phoneNumber || !country) {
        return res.status(400).json({
          message:
            "firstName, surname, phoneNumber and country are required for Personal accounts",
        });
      }

      userData = {
        ...userData,
        firstName,
        middleName: middleName || "",
        surname,
        phoneNumber,
      };
    }

    // MERCHANT ACCOUNT
    else if (accountType === "Merchant") {
      if (!businessName || !industry || !companyAddress) {
        return res.status(400).json({
          message:
            "businessName, industry and companyAddress are required for Merchant accounts",
        });
      }

      userData = {
        ...userData,
        businessName,
        industry,
        companyAddress,
      };
    } else {
      return res.status(400).json({ message: "Invalid account type" });
    }

    console.log("💾 Final User Data:", {
      ...userData,
      password: "[REDACTED]",
    });

    // Save user
  const newUser = await User.create(userData);

    // 🔥 Send OTP (DO NOT BLOCK USER CREATION)
    sendOTPEmail(email, otp).catch((err) => {
      console.error("❌ OTP email failed:", err.message);
    });

  const userResponse = newUser.toJSON();
    delete userResponse.password;
    delete userResponse.otp;
    delete userResponse.otpExpires;

    res.status(201).json({
      message: "User registered successfully. OTP sent to email.",
      user: userResponse,
      requiresVerification: true,
    });
  } catch (error) {
    console.error("❌ Registration error:", error);

    if (error.code === 11000) {
      const key = Object.keys(error.keyValue)[0];

      return res.status(409).json({
        message: `${key} already exists`,
        field: key,
      });
    }

    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Add login functionality
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`🔐 Login attempt for: ${email}`);

    // Find the user by email - case insensitive search
    const user = await User.findOne({
     where: {
    email: {
      [Op.iLike]: email,
    },
  },
      
    });

    // Debug: Log what we found
    console.log(
      "🔍 User search result:",
      user ? "User found" : "User NOT found",
    );

    // If user doesn't exist
    if (!user) {
      console.log(`❌ Login failed: User not found for email ${email}`);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if the user has verified their email
    if (!user.emailVerified) {
      console.log(`⚠️ Login failed: Email not verified for user ${email}`);
      return res.status(403).json({
        message: "Please verify your email before logging in",
        emailVerificationRequired: true,
      });
    }

    // Check if the user account is active
    if (user.status_client === "Inactive") {
      console.log(`⚠️ Login failed: Account inactive for user ${email}`);
      return res.status(403).json({ message: "Your account is inactive" });
    }

    // Debug: Log password details
    console.log("🔒 Password from request (first char):", password.charAt(0));
    console.log(
      "🔒 Stored password hash (first 10 chars):",
      user.password.substring(0, 10),
    );

    // Verify password
    console.log("🔄 Comparing passwords...");
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(
      "🔑 Password comparison result:",
      isPasswordValid ? "MATCH" : "NO MATCH",
    );

    if (!isPasswordValid) {
      console.log(`❌ Login failed: Invalid password for user ${email}`);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if user has a wallet, create one if not
    const existingWallet = await Wallet.findOne({
        where:{
        userId:user.id
    }
    });

    if (!existingWallet) {
      console.log(`🏦 User ${user.id} doesn't have a wallet, creating one...`);

      // Generate a unique account number using user's country code
      const accountNumber = generateAccountNumber(user.countryCode);

      // Determine currency based on user's country
      let currency;
      try {
        // Import the getCurrencyForUser function
        const { getCurrencyForUser } = require("../utils/transactionFeeUtils");

        // Determine currency based on user data
        currency = getCurrencyForUser(user);
        console.log(
          `🌐 Determined currency ${currency} for user based on country: ${user.country} (${user.countryCode})`,
        );
      } catch (currencyError) {
        console.error(
          `❌ Error determining currency: ${currencyError.message}`,
        );
        return res.status(400).json({
          message: `Cannot initialize wallet: ${currencyError.message}. Please update your profile with a valid country.`,
        });
      }

      // Create a new wallet for the user with proper currency
      const newWallet = await Wallet.create({
        userId: user.id,
        accountNumber,
        balance: 0,
        currency,
        isActive: true,
      });

      console.log(
        `💰 Wallet created for user ${user.id} with account number: ${accountNumber} and currency: ${currency}`,
      );
    } else {
      console.log(
        `💼 User ${user.id} already has wallet with account: ${existingWallet.accountNumber}`,
      );
    }

    // Debug: Log full user object (except password)
   const debugUser = user.toJSON();
    delete debugUser.password;
    console.log("👤 User details:", JSON.stringify(debugUser, null, 2));

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || "patchpay-secret-key-7d9ac52e";
    const token = jwt.sign(
      { userId: user.id, email: user.email, accountType: user.accountType },
      jwtSecret,
      { expiresIn: "24h" },
    );

    // Return user info without password
   const userResponse = user.toJSON();
    delete userResponse.password;

    console.log(`✅ Login successful for user: ${email}`);
    res.status(200).json({
      message: "Login successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({
      message: "Error during login",
      error: error.message,
    });
  }
};

// Email verification function

const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log(`🔄 Verifying email for: ${email} with Otp: ${otp}`);

    if (!otp || !email) {
      return res.status(400).json({ message: "Invalid verification link" });
    }

    // Find user by email and token
  const user = await User.findOne({
  where: {
    email,
    otp: String(otp),
    otpExpires: {
      [Op.gt]: new Date(),
    },
    emailVerified: false,
  },
});

    if (!user) {
      console.log(`❌ Verification failed: Invalid Otp or email ${email}`);
      return res
        .status(400)
        .json({ message: "Invalid or expired verification link" });
    }

    // Update user to verified and active status
    user.emailVerified = true;
    user.status_client = "Active";
    user.emailVerificationToken = ""; // Clear the token
    await user.save();

    // Check if user already has a wallet
    let userWallet = await Wallet.findOne({ where: { userId: user.id } });

    // If no wallet exists, create one with a unique account number
    if (!userWallet) {
      console.log(`🏦 Creating wallet for newly verified user: ${user.id}`);

      // Generate unique account number using user's country code
      const accountNumber = generateAccountNumber(user.countryCode);

      // Determine currency based on user's country
      let currency;
      try {
        // Import the getCurrencyForUser function
        const { getCurrencyForUser } = require("../utils/transactionFeeUtils");

        // Determine currency based on user data
        currency = getCurrencyForUser(user);
        console.log(
          `🌐 Determined currency ${currency} for user based on country: ${user.country} (${user.countryCode})`,
        );
      } catch (currencyError) {
        console.error(
          `❌ Error determining currency: ${currencyError.message}`,
        );
        // Continue with wallet creation but log the error
        console.error(
          `❌ Will fall back to default currency handling in wallet controller later.`,
        );
        // We don't return an error here since we don't want to block email verification
      }

      // Create new wallet with proper currency
      userWallet = await Wallet.create({
        userId: user.id,
        accountNumber,
        balance: 0,
        currency,
        isActive: true,
      });

      console.log(
        `💰 Wallet created successfully with account number: ${accountNumber} and currency: ${currency}`,
      );
    }

    console.log(`✅ Email verified successfully for user: ${email}`);

    res
      .status(200)
      .json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    console.error("❌ Email verification error:", error);
    res
      .status(500)
      .json({ message: "Error verifying email", error: error.message });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    console.log(`🔄 Resending OTP for: ${email}`);

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({
       where: {
        email,
    },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        message: "Email already verified",
      });
    }

    // 🔥 Generate new OTP
    const { generateOTP, sendOTPEmail } = require("../services/emailService");
    const newOtp = generateOTP();

    // 🔥 Update user
    user.otp = newOtp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 mins

    await user.save();

    // 🔥 Send email (non-blocking)
    sendOTPEmail(email, newOtp).catch((err) => {
      console.error("❌ Failed to resend OTP:", err.message);
    });

    console.log(`✅ OTP resent successfully to: ${email}`);

    return res.status(200).json({
      message: "OTP resent successfully",
      success: true,
    });
  } catch (error) {
    console.error("❌ Resend OTP error:", error);

    return res.status(500).json({
      message: "Error resending OTP",
      error: error.message,
    });
  }
};

// Add a logout controller function
const logout = async (req, res) => {
  try {
    console.log("👋 User logged out from backend");

    // Clear any HTTP-only cookies
    res.clearCookie("token");

    // Return success
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("❌ Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Error during logout",
      error: error.message,
    });
  }
};

const getUserProfile = async (req, res) => {
  try {
    console.log("📥 Fetching user profile for ID:", req.user.id);

    // Find user by ID from the authenticated request
const user = await User.findByPk(req.user.id,{
    attributes:{
        exclude:["password"]
    }
});

    if (!user) {
      console.log("❌ User not found:", req.user.id);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ User profile found:", user.email);
    res.status(200).json(user);
  } catch (error) {
    console.error("❌ Error fetching user profile:", error);
    res.status(500).json({ message: "Error fetching user profile" });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    console.log("📝 Updating user profile for ID:", req.user.id);
    console.log("📦 Update payload:", req.body);

    // Find user by ID
    const user = await User.findByPk(req.user.id);
    if (!user) {
      console.log("❌ User not found:", req.user.id);
      return res.status(404).json({ message: "User not found" });
    }

    // Update allowed fields
    const allowedFields = [
      "firstName",
      "middleName",
      "surname",
      "address",
      "phoneNumber",
      "country",
      "countryCode",
      "state",
      "continent",
    ];

    // Only update fields that are provided and allowed
    Object.keys(req.body).forEach((field) => {
      if (allowedFields.includes(field)) {
        user[field] = req.body[field];
      }
    });

    // Special handling for address object
    if (req.body.address) {
      user.address = {
        ...user.address,
        ...req.body.address,
      };
    }

    // Save the updated user
    await user.save();
    console.log("✅ User profile updated successfully");

    // Return updated user without password
   const updatedUser = user.toJSON();
    delete updatedUser.password;

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("❌ Error updating user profile:", error);
    res.status(500).json({ message: "Error updating user profile" });
  }
};

const setTransactionPin = async (req, res) => {
  try {
    const { transactionPin, confirmTransactionPin } = req.body;

    if (!transactionPin || !confirmTransactionPin) {
      return res.status(400).json({
        message: "transactionPin and confirmTransactionPin are required",
      });
    }

    if (transactionPin !== confirmTransactionPin) {
      return res.status(400).json({
        message: "Transaction PINs do not match",
      });
    }

    if (!/^\d{4}$/.test(transactionPin)) {
      return res.status(400).json({
        message: "Transaction PIN must be exactly 4 digits",
      });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.transactionPinHash = await bcrypt.hash(transactionPin, 10);
    user.hasTransactionPin = true;
    await user.save();

    res.status(200).json({
      message: "Transaction PIN configured successfully",
    });
  } catch (error) {
    console.error("❌ Error setting transaction PIN:", error);
    res.status(500).json({ message: "Error setting transaction PIN" });
  }
};

const changeTransactionPin = async (req, res) => {
  try {
    const { currentPin, newPin, confirmPin } = req.body;

    if (!currentPin || !newPin || !confirmPin) {
      return res.status(400).json({
        message: "Current PIN, new PIN and confirmation PIN are required",
      });
    }

    if (!/^\d{4}$/.test(currentPin)) {
      return res.status(400).json({
        message: "Current PIN must be exactly 4 digits",
      });
    }

    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({
        message: "New PIN must be exactly 4 digits",
      });
    }

    if (newPin !== confirmPin) {
      return res.status(400).json({
        message: "New PINs do not match",
      });
    }

    if (currentPin === newPin) {
      return res.status(400).json({
        message: "New PIN must be different from your current PIN",
      });
    }

    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.hasTransactionPin || !user.transactionPinHash) {
      return res.status(400).json({
        message: "You do not have a transaction PIN configured",
      });
    }

    // Verify current PIN
    const isCurrentPinValid = await bcrypt.compare(
      currentPin,
      user.transactionPinHash
    );

    if (!isCurrentPinValid) {
      return res.status(401).json({
        message: "Current transaction PIN is incorrect",
      });
    }

    // Hash and save new PIN
    user.transactionPinHash = await bcrypt.hash(newPin, 10);
    user.hasTransactionPin = true;

    await user.save();

    return res.status(200).json({
      message: "Transaction PIN changed successfully",
    });
  } catch (error) {
    console.error("❌ Error changing transaction PIN:", error);

    return res.status(500).json({
      message: "Error changing transaction PIN",
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({
      where: { email },
    });

    // Don't reveal whether the email exists
    if (!user) {
      return res.status(200).json({
        message:
          "If an account exists with this email, a reset code has been sent.",
      });
    }

    const { generateOTP, sendPasswordResetEmail } = require("../services/emailService");

    const otp = generateOTP();

    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);

    await user.save();

    await emailService.sendPasswordResetOTP(user.email, otp);

    return res.status(200).json({
      message: "Password reset OTP sent successfully",
    });
  } catch (error) {
    console.error("❌ Forgot Password Error:", error);

    return res.status(500).json({
      message: "Error sending password reset OTP",
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;

    if (!email || !otp || !password || !confirmPassword) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    const user = await User.findOne({
      where: {
        email,
        resetPasswordOtp: String(otp),
        resetPasswordExpires: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetPasswordOtp = null;
    user.resetPasswordExpires = null;

    await user.save();

    return res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("❌ Reset Password Error:", error);

    return res.status(500).json({
      message: "Error resetting password",
      error: error.message,
    });
  }
};

// Export all controller functions
module.exports = {
  registerUser,
  loginUser,
  verifyEmail,
  resendOtp,
  logout,
  getUserProfile,
  updateUserProfile,
  setTransactionPin,
  changeTransactionPin,
  forgotPassword,
  resetPassword
};
