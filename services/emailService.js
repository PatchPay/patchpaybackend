const nodemailer = require('nodemailer');

// Load environment variables
require('dotenv').config();

// Set up nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter verification failed:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

/**
 * Send a test email to verify email functionality
 * @param {string} recipientEmail - The email to send the test to
 * @returns {Promise} - Promise with the email sending result
 */
const sendTestEmail = async (recipientEmail) => {
  try {
    console.log(`Attempting to send test email to ${recipientEmail} from ${process.env.EMAIL_USER}`);
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: 'Test Email from PatchPay',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4a4a4a;">Test Email from PatchPay</h2>
          <p>This is a test email to verify that the email functionality is working.</p>
          <p>Current time: ${new Date().toISOString()}</p>
          <p>If you received this email, the email system is working correctly!</p>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Test email sent:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending test email:', error);
    throw error;
  }
};

/**
 * Send verification email to new users
 * @param {string} userEmail - The user's email address
 * @param {string} verificationToken - The token for email verification
 * @returns {Promise} - Promise with the email sending result
 */
const sendVerificationEmail = async (userEmail, verificationToken) => {
  try {
    console.log(`⏳ Starting email verification process for ${userEmail}`);
    console.log(`🔑 Using token: ${verificationToken.substring(0, 8)}...`);
    
    // Get the correct frontend URL from environment variables
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
    console.log(`🌐 Using FRONTEND_URL: "${frontendUrl}"`);
    
    // Create verification URLs
    const appVerificationUrl = `${frontendUrl}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(userEmail)}`;
    const backendVerificationUrl = `http://localhost:5000/api/users/verify-email-page?token=${verificationToken}&email=${encodeURIComponent(userEmail)}`;
    
    console.log(`🔗 App Verification URL: ${appVerificationUrl}`);
    console.log(`🔗 Backend Verification URL: ${backendVerificationUrl}`);
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: 'Verify Your PatchPay Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4a4a4a;">Welcome to PatchPay!</h2>
          <p>Thank you for registering. Please verify your email to activate your account by clicking the button below:</p>
          
          <p style="margin: 20px 0;">
            <a href="${backendVerificationUrl}" style="background-color: #7B68EE; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email</a>
          </p>
          
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #6c757d;">${backendVerificationUrl}</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="color: #888;">If you prefer to verify using the PatchPay app directly once the issues are fixed, you can use this link instead:</p>
            <p style="word-break: break-all; color: #6c757d;"><a href="${appVerificationUrl}" style="color: #7B68EE; text-decoration: underline;">App Verification Link</a></p>
          </div>
          
          <p style="margin-top: 30px;">This link will expire in 24 hours.</p>
          <p>If you didn't register for PatchPay, please ignore this email.</p>
        </div>
      `
    };
    
    console.log(`📨 Attempting to send email to: ${userEmail}`);
    
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Verification email sent successfully:', info.response);
      return info;
    } catch (sendError) {
      console.error('⚠️ Transporter.sendMail failed with error:', sendError);
      throw sendError;
    }
  } catch (error) {
    console.error('❌ Error in sendVerificationEmail function:', error);
    console.error('❌ Error details:', error.message);
    if (error.code) {
      console.error('❌ Error code:', error.code);
    }
    throw error;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
  try {
    console.log('Attempting to send password reset email to:', user.email);
    
    // Get the correct frontend URL from environment variables
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
    console.log(`🌐 Using FRONTEND_URL: "${frontendUrl}"`);
    
    // Create reset URLs for both backend and app
    const backendResetUrl = `http://localhost:5000/api/users/reset-password-page?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
    const appResetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
    
    console.log(`🔗 Backend Reset URL: ${backendResetUrl}`);
    console.log(`🔗 App Reset URL: ${appResetUrl}`);

    const mailOptions = {
      from: `"PatchPay" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1772CC; text-align: center;">Reset Your Password</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password for your PatchPay account. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${backendResetUrl}" 
               style="background-color: #1772CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #1772CC;">${backendResetUrl}</p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="color: #888;">If you prefer to reset your password using the PatchPay app directly, you can use this link instead:</p>
            <p style="word-break: break-all; color: #6c757d;"><a href="${appResetUrl}" style="color: #1772CC; text-decoration: underline;">App Reset Link</a></p>
          </div>

          <p>This link will expire in 1 hour for security reasons.</p>
          <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully to:', user.email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

// Add password reset confirmation email function
const sendPasswordResetConfirmation = async (user) => {
  try {
    console.log(`📧 Sending password reset confirmation to: ${user.email}`);
    
    // Get the correct frontend URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'PatchPay - Password Reset Successful',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #474747;">Patch<span style="color: #1772CC;">Pay</span></h1>
          </div>
          
          <h2>Password Reset Successful</h2>
          
          <p>Your password has been successfully reset. You can now log in to your account with your new password.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${frontendUrl}/auth/sign_in" style="background-color: #1772CC; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Log In</a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #777; font-size: 12px;">
            <p>If you didn't reset your password, please contact support immediately.</p>
          </div>
        </div>
      `
    };
    
    console.log('📤 Sending confirmation email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset confirmation email sent successfully:', info.response);
    return true;
  } catch (error) {
    console.error('❌ Error sending password reset confirmation:', error);
    throw error;
  }
};

// Export all functions
module.exports = {
  sendTestEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmation
}; 