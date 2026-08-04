require("dotenv").config();
const nodemailer = require("nodemailer");

// Gmail transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, // Gmail App Password
  },
});

// Verify SMTP connection
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP Connection Error:", error);
  } else {
    console.log("✅ Gmail SMTP is ready to send emails");
  }
});

// ✅ Reusable sender
const sendEmail = async ({ to, subject, html }) => {
  try {
    const response = await transporter.sendMail({
      from: `"PatchPay" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", response.messageId);
    return response;
  } catch (error) {
    console.error("❌ Email error:", error);
    throw error;
  }
};

// 🔢 Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ✉️ Send OTP Email
const sendOTPEmail = async (userEmail, otp) => {
  return sendEmail({
    to: userEmail,
    subject: "Your PatchPay Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Verify Your Account</h2>

        <p>Your OTP code is:</p>

        <h1 style="text-align:center; letter-spacing:5px;">
          ${otp}
        </h1>

        <p>This code expires in <strong>10 minutes</strong>.</p>

        <p>If you didn't request this verification, you can safely ignore this email.</p>

        <hr>

        <small>PatchPay Team</small>
      </div>
    `,
  });
};

// 🔐 Password Reset OTP Email
const sendPasswordResetOTP = async (userEmail, otp) => {
  return sendEmail({
    to: userEmail,
    subject: "Reset Your Password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Password Reset</h2>

        <p>Your password reset code is:</p>

        <h1 style="text-align:center; letter-spacing:5px;">
          ${otp}
        </h1>

        <p>This code expires in <strong>10 minutes</strong>.</p>

        <p>If you didn't request a password reset, please ignore this email.</p>

        <hr>

        <small>PatchPay Team</small>
      </div>
    `,
  });
};

module.exports = {
  sendEmail,
  generateOTP,
  sendOTPEmail,
  sendPasswordResetOTP,
};