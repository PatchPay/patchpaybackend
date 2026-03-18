require("dotenv").config();
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// ✅ Reusable sender
const sendEmail = async ({ to, subject, html }) => {
  try {
    const response = await resend.emails.send({
      from: "PatchPay <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", response);
    return response;
  } catch (error) {
    console.error("❌ Email error:", error);
    throw error;
  }
};

// 🔢 Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
};

// ✉️ Send OTP Email
const sendOTPEmail = async (userEmail, otp) => {
  return sendEmail({
    to: userEmail,
    subject: "Your PatchPay Verification Code",
    html: `
      <div style="font-family: Arial; max-width: 600px; margin: auto;">
        <h2>Verify Your Account</h2>
        <p>Your OTP code is:</p>

        <h1 style="letter-spacing: 5px; text-align:center;">
          ${otp}
        </h1>

        <p>This code expires in 10 minutes.</p>
        <p>If you didn’t request this, ignore this email.</p>
      </div>
    `,
  });
};

// 🔐 Password Reset OTP Email
const sendPasswordResetOTP = async (userEmail, otp) => {
  return sendEmail({
    to: userEmail,
    subject: "Reset Your Password - OTP",
    html: `
      <div style="font-family: Arial; max-width: 600px; margin: auto;">
        <h2>Password Reset</h2>
        <p>Your reset code is:</p>

        <h1 style="letter-spacing: 5px; text-align:center;">
          ${otp}
        </h1>

        <p>This code expires in 10 minutes.</p>
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
