const express = require("express");
const router = express.Router();
const userController = require("../Controllers/userController");
const {
  validatePersonalRegistration,
  validateUser,
} = require("../middlewares/validateuser");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const emailService = require("../services/emailService");
const { authenticateToken } = require("../middlewares/authMiddleware");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

// Test route to verify the router is working
router.get("/test", (req, res) => {
  res.status(200).json({ message: "User routes are working" });
});

// Test route for sending email
router.get("/test-email", async (req, res) => {
  try {
    // Send test email to user
    const recipientEmail = "miguelangelosilva@hotmail.co.uk";
    const info = await emailService.sendTestEmail(recipientEmail);

    res.status(200).json({
      message: "Test email sent successfully",
      info: {
        messageId: info.messageId,
        response: info.response,
      },
    });
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({
      message: "Error sending test email",
      error: error.message,
      stack: error.stack,
    });
  }
});

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Register a new user
 *     description: Creates a new PatchPay account.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               surname:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 */
router.post("/register", validateUser, userController.registerUser);

// Route for personal user registration
// router.post("/register", validateUser, userController.registerUser);

// Route for all other account types (Merchant, NGO, Government)
// Using the full validateUser middleware that checks all fields
// router.post("/register/merchant", validateUser, userController.registerUser);
// router.post("/register/ngo", validateUser, userController.registerUser);
// router.post("/register/government", validateUser, userController.registerUser);

// Login route
router.post("/login", userController.loginUser);

// Email verification route
router.post("/verify-email", userController.verifyEmail);
router.post("/resend-otp", userController.resendOtp);

// TEMPORARY TEST ROUTE for direct login (REMOVE IN PRODUCTION)
router.post("/test-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`🧪 TEST LOGIN attempt for: ${email}`);

    // Find the user with any case
    const { Op } = require("sequelize");
    const user = await User.findOne({ where: { email: { [Op.iLike]: email } } });

    if (!user) {
      console.log(`❌ TEST LOGIN failed: User not found for email ${email}`);
      return res.status(401).json({
        message: "User not found",
        debug: { emailSearched: email },
      });
    }

    // Log the stored password hash for debugging
    console.log("🔒 Stored password hash:", user.password);

    // Check if raw password matches exactly what's in database (UNSAFE, for testing only)
    if (password === user.password) {
      console.log("⚠️ WARNING: Using raw password comparison!");
      // Generate simple token
      const token = "test-token-" + Date.now();

      // Return user (without sensitive fields)
      const userResponse = { ...user.toJSON() };
      delete userResponse.password;

      return res.status(200).json({
        message: "TEST LOGIN successful (raw password)",
        token,
        user: userResponse,
        debug: { passwordMatch: "raw" },
      });
    }

    // Try with bcrypt
    const bcryptMatch = await bcrypt.compare(password, user.password);
    console.log(
      "🔑 bcrypt comparison result:",
      bcryptMatch ? "MATCH" : "NO MATCH",
    );

    // Return comprehensive debug info
    return res.status(401).json({
      message: "Password mismatch",
      debug: {
        emailFound: true,
        emailSearched: email,
        passwordFirstChar: password.charAt(0),
        bcryptMatchResult: bcryptMatch,
        passwordHashLength: user.password.length,
      },
    });
  } catch (error) {
    console.error("❌ TEST LOGIN Error:", error);
    res.status(500).json({
      message: "Error during test login",
      error: error.message,
    });
  }
});

// Test route for direct registration with email verification
router.post("/test-register", async (req, res) => {
  try {
    console.log(
      "📩 TEST REGISTER: Starting test registration with email verification",
    );

    // Extract the email from the request
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    console.log(`📧 TEST REGISTER: Using email: ${email}`);

    // Generate a verification token
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    console.log(
      `🔑 TEST REGISTER: Generated token: ${emailVerificationToken.substring(0, 8)}...`,
    );

    // Attempt to send a verification email
    console.log(
      "📤 TEST REGISTER: Attempting to send email through emailService",
    );
    try {
      const info = await emailService.sendVerificationEmail(
        email,
        emailVerificationToken,
      );
      console.log("✅ TEST REGISTER: Email sent successfully:", info.response);
      res.status(200).json({
        message: "Test registration email sent successfully",
        email,
        info: {
          messageId: info.messageId,
          response: info.response,
        },
      });
    } catch (emailError) {
      console.error("❌ TEST REGISTER: Failed to send email:", emailError);
      res.status(500).json({
        message: "Error sending test registration email",
        error: emailError.message,
        email,
      });
    }
  } catch (error) {
    console.error("❌ TEST REGISTER: Unexpected error:", error);
    res.status(500).json({
      message: "Error in test registration",
      error: error.message,
    });
  }
});

// Direct verification route that serves HTML content
router.get("/verify-email-page", async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).send(`
        <html>
          <head>
            <title>Verification Failed</title>
            <style>
              body { font-family: Arial; text-align: center; padding: 50px; }
              .error { color: red; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1 class="error">Verification Failed</h1>
            <p>Invalid verification link. Missing token or email.</p>
            <a href="http://localhost:8081/auth/sign_in">Go to Login</a>
          </body>
        </html>
      `);
    }

    // Find user by email and token
    const user = await User.findOne({ where: { email, emailVerificationToken: token, emailVerified: false } });

    if (!user) {
      return res.status(400).send(`
        <html>
          <head>
            <title>Verification Failed</title>
            <style>
              body { font-family: Arial; text-align: center; padding: 50px; }
              .error { color: red; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1 class="error">Verification Failed</h1>
            <p>Invalid or expired verification link.</p>
            <a href="http://localhost:8081/auth/sign_in">Go to Login</a>
          </body>
        </html>
      `);
    }

    // Update user
    user.emailVerified = true;
    user.status_client = "Active";
    user.emailVerificationToken = "";
    await user.save();

    // Return HTML response
    return res.status(200).send(`
      <html>
        <head>
          <title>Email Verified | PatchPay</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background-color: #f4f6f8;
            }
            .container {
              max-width: 500px;
              width: 90%;
              background-color: #fff;
              border-radius: 10px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
              padding: 30px;
              text-align: center;
            }
            .logo {
              margin-bottom: 20px;
              font-size: 28px;
              font-weight: bold;
              color: #7B68EE;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              color: #333;
              margin-bottom: 20px;
            }
            .success-message {
              color: #4CAF50;
              font-weight: bold;
              font-size: 20px;
              margin-bottom: 10px;
            }
            .message {
              color: #666;
              margin-bottom: 20px;
              line-height: 1.5;
            }
            .button {
              background-color: #7B68EE;
              color: white;
              border: none;
              padding: 12px 24px;
              font-size: 16px;
              border-radius: 5px;
              cursor: pointer;
              font-weight: bold;
              transition: background-color 0.3s;
              text-decoration: none;
              display: inline-block;
            }
            .button:hover {
              background-color: #6A5ACD;
            }
            .countdown {
              font-weight: bold;
              margin-top: 10px;
              color: #666;
            }
          </style>
          <script>
            // Redirect to login after 5 seconds
            setTimeout(function() {
              window.location.href = 'http://localhost:8081/auth/sign_in';
            }, 5000);
            
            // Countdown
            let seconds = 5;
            setInterval(function() {
              seconds--;
              if (seconds >= 0) {
                document.getElementById('countdown').innerText = seconds;
              }
            }, 1000);
          </script>
        </head>
        <body>
          <div class="container">
            <div class="logo">PatchPay</div>
            <h1 class="title">Email Verification</h1>
            <p class="success-message">Email Verified Successfully!</p>
            <p class="message">Your account is now active. You can now log in to access your PatchPay account.</p>
            <a href="http://localhost:8081/auth/sign_in" class="button">Go to Login</a>
            <p class="countdown">Redirecting in <span id="countdown">5</span> seconds...</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error during page verification:", error);
    return res.status(500).send(`
      <html>
        <head>
          <title>Verification Error</title>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; }
            .error { color: red; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1 class="error">Verification Error</h1>
          <p>There was a problem processing your verification. Please try again or contact support.</p>
          <a href="http://localhost:8081/auth/sign_in">Go to Login</a>
        </body>
      </html>
    `);
  }
});

// Add logout route to clear cookies
router.post("/logout", authenticateToken, userController.logout);


// forget password 
router.post("/forget-password" , userController.forgotPassword)


router.post("/reset-password", userController.resetPassword )

// Profile routes (protected by authentication)
router.get("/profile", authenticateToken, userController.getUserProfile);
router.put("/profile", authenticateToken, userController.updateUserProfile);
router.post(
  "/transaction-pin",
  authenticateToken,
  userController.setTransactionPin,
);

module.exports = router;
