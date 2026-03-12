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

// Route for personal user registration
router.post(
  "/register",
  validatePersonalRegistration,
  userController.registerUser,
);

// Route for all other account types (Merchant, NGO, Government)
// Using the full validateUser middleware that checks all fields
router.post("/register/merchant", validateUser, userController.registerUser);
router.post("/register/ngo", validateUser, userController.registerUser);
router.post("/register/government", validateUser, userController.registerUser);

// Login route
router.post("/login", userController.loginUser);

// Email verification route
router.get("/verify-email", userController.verifyEmail);

// TEMPORARY TEST ROUTE for direct login (REMOVE IN PRODUCTION)
router.post("/test-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`🧪 TEST LOGIN attempt for: ${email}`);

    // Find the user with any case
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

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
      const userResponse = { ...user.toObject() };
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
    const user = await User.findOne({
      email,
      emailVerificationToken: token,
      emailVerified: false,
    });

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

// Forgot password route
router.post("/forgot-password", async (req, res) => {
  try {
    console.log("==== FORGOT PASSWORD REQUEST RECEIVED ====");
    console.log("Request body:", req.body);
    console.log("Request headers:", req.headers);

    const { email } = req.body;

    if (!email) {
      console.log("❌ No email provided");
      return res.status(400).json({
        message: "Email is required",
      });
    }

    console.log(`🔍 Looking up user with email: ${email}`);
    // Find user by email
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (!user) {
      console.log("ℹ️ No user found with this email");
      // Return success even if user not found to prevent email enumeration
      return res.status(200).json({
        message:
          "If an account exists with this email, a password reset link will be sent.",
      });
    }

    console.log("✅ User found, generating reset token");
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // Token expires in 1 hour

    // Save reset token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();
    console.log("✅ Reset token saved to user");

    try {
      // Send password reset email
      await emailService.sendPasswordResetEmail(user, resetToken);
      console.log("✅ Password reset email sent successfully");
    } catch (emailError) {
      console.error("❌ Error sending password reset email:", emailError);
      // Clear the reset token since email failed
      user.resetPasswordToken = "";
      user.resetPasswordExpires = null;
      await user.save();
      throw emailError;
    }

    console.log("==== FORGOT PASSWORD REQUEST COMPLETED ====");
    res.status(200).json({
      message:
        "If an account exists with this email, a password reset link will be sent.",
    });
  } catch (error) {
    console.error("❌ Error in forgot password:", error);
    res.status(500).json({
      message: "Error processing forgot password request",
      error: error.message,
    });
  }
});

// Validate reset token route
router.get("/validate-reset-token", async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({ message: "Token and email are required" });
    }

    const user = await User.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    res.status(200).json({ message: "Valid reset token" });
  } catch (error) {
    console.error("Error validating reset token:", error);
    res.status(500).json({ message: "Error validating reset token" });
  }
});

// Reset password route
router.post("/reset-password", async (req, res) => {
  try {
    const { token, email, password } = req.body;

    if (!token || !email || !password) {
      return res
        .status(400)
        .json({ message: "Token, email, and new password are required" });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user's password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = "";
    user.resetPasswordExpires = null;
    await user.save();

    // Send confirmation email
    await emailService.sendPasswordResetConfirmation(user);

    // Generate JWT token for automatic login
    const jwtSecret = process.env.JWT_SECRET || "patchpay-secret-key-7d9ac52e";
    const authToken = jwt.sign(
      { userId: user._id, email: user.email, accountType: user.accountType },
      jwtSecret,
      { expiresIn: "24h" },
    );

    // Return user info without password
    const userResponse = { ...user.toObject() };
    delete userResponse.password;

    res.status(200).json({
      message: "Password reset successfully",
      token: authToken,
      user: userResponse,
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Error resetting password" });
  }
});

// Reset password page route that serves HTML content
router.get("/reset-password-page", async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).send(`
        <html>
          <head>
            <title>Reset Password Failed</title>
            <style>
              body { font-family: Arial; text-align: center; padding: 50px; }
              .error { color: red; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1 class="error">Reset Password Failed</h1>
            <p>Invalid reset password link. Missing token or email.</p>
            <a href="http://localhost:8081/auth/sign_in">Go to Login</a>
          </body>
        </html>
      `);
    }

    // Find user with valid reset token
    const user = await User.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).send(`
        <html>
          <head>
            <title>Reset Password Failed</title>
            <style>
              body { font-family: Arial; text-align: center; padding: 50px; }
              .error { color: red; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1 class="error">Reset Password Failed</h1>
            <p>Invalid or expired reset password link.</p>
            <a href="http://localhost:8081/auth/sign_in">Go to Login</a>
          </body>
        </html>
      `);
    }

    // Return HTML response with password reset form
    return res.status(200).send(`
      <html>
        <head>
          <title>Reset Password | PatchPay</title>
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
              color: #1772CC;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              color: #333;
              margin-bottom: 20px;
            }
            .form-group {
              margin-bottom: 20px;
              text-align: left;
            }
            .label {
              display: block;
              margin-bottom: 8px;
              color: #333;
              font-weight: bold;
            }
            .input {
              width: 100%;
              padding: 12px;
              border: 1px solid #ddd;
              border-radius: 5px;
              font-size: 16px;
              box-sizing: border-box;
            }
            .error-message {
              color: #ff0000;
              margin-top: 5px;
              display: none;
            }
            .button {
              background-color: #1772CC;
              color: white;
              border: none;
              padding: 12px 24px;
              font-size: 16px;
              border-radius: 5px;
              cursor: pointer;
              font-weight: bold;
              transition: background-color 0.3s;
              width: 100%;
            }
            .button:hover {
              background-color: #1565C0;
            }
            .button:disabled {
              background-color: #ccc;
              cursor: not-allowed;
            }
          </style>
          <script>
            function validateForm() {
              const password = document.getElementById('password').value;
              const confirmPassword = document.getElementById('confirmPassword').value;
              const errorMessage = document.getElementById('errorMessage');
              const submitButton = document.getElementById('submitButton');

              // Reset error message
              errorMessage.style.display = 'none';
              
              // Validate password length
              if (password.length < 6) {
                errorMessage.textContent = 'Password must be at least 6 characters long';
                errorMessage.style.display = 'block';
                return false;
              }

              // Validate password match
              if (password !== confirmPassword) {
                errorMessage.textContent = 'Passwords do not match';
                errorMessage.style.display = 'block';
                return false;
              }

              // Disable button and show loading state
              submitButton.disabled = true;
              submitButton.textContent = 'Resetting Password...';

              // Submit the form
              fetch('/api/users/reset-password', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  token: '${token}',
                  email: '${email}',
                  password: password
                })
              })
              .then(response => response.json())
              .then(data => {
                if (data.message === 'Password reset successfully') {
                  // Show success message and redirect
                  alert('Password reset successful! You can now log in with your new password.');
                  window.location.href = 'http://localhost:8081/auth/sign_in';
                } else {
                  // Show error message
                  errorMessage.textContent = data.message || 'An error occurred';
                  errorMessage.style.display = 'block';
                  submitButton.disabled = false;
                  submitButton.textContent = 'Reset Password';
                }
              })
              .catch(error => {
                errorMessage.textContent = 'An error occurred. Please try again.';
                errorMessage.style.display = 'block';
                submitButton.disabled = false;
                submitButton.textContent = 'Reset Password';
              });

              return false;
            }
          </script>
        </head>
        <body>
          <div class="container">
            <div class="logo">PatchPay</div>
            <h1 class="title">Reset Your Password</h1>
            <form onsubmit="return validateForm()">
              <div class="form-group">
                <label class="label" for="password">New Password</label>
                <input type="password" id="password" class="input" placeholder="Enter new password" required>
              </div>
              <div class="form-group">
                <label class="label" for="confirmPassword">Confirm New Password</label>
                <input type="password" id="confirmPassword" class="input" placeholder="Confirm new password" required>
              </div>
              <p id="errorMessage" class="error-message"></p>
              <button type="submit" id="submitButton" class="button">Reset Password</button>
            </form>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error during password reset:", error);
    return res.status(500).send(`
      <html>
        <head>
          <title>Reset Password Error</title>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; }
            .error { color: red; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1 class="error">Reset Password Error</h1>
          <p>There was a problem processing your password reset. Please try again or contact support.</p>
          <a href="http://localhost:8081/auth/sign_in">Go to Login</a>
        </body>
      </html>
    `);
  }
});

// Profile routes (protected by authentication)
router.get("/profile", authenticateToken, userController.getUserProfile);
router.put("/profile", authenticateToken, userController.updateUserProfile);

module.exports = router;
