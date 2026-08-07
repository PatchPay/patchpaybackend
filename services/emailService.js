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



const sendRFQNotificationEmail = async (recipient, sender, rfq) => {
  const recipientName =
    `${recipient.firstName || ""} ${recipient.surname || ""}`.trim();

  const senderName =
    `${sender.firstName || ""} ${sender.surname || ""}`.trim();

  const amount = Number(rfq.amount || 0).toLocaleString();

  return sendEmail({
    to: recipient.email,
    subject: `New RFQ Received - #${rfq.quote_number}`,

    html: `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        padding: 30px;
        background-color: #ffffff;
        color: #333333;
      ">

        <h2 style="
          color: #111827;
          margin-bottom: 10px;
        ">
          New RFQ Received
        </h2>

        <p>
          Hello <strong>${recipientName}</strong>,
        </p>

        <p>
          You have received a new Request for Quotation (RFQ)
          from <strong>${senderName}</strong> on PatchPay.
        </p>

        <div style="
          background-color: #f8f9fa;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        ">

          <p>
            <strong>RFQ Number:</strong>
            #${rfq.quote_number}
          </p>

          <p>
            <strong>Product:</strong>
            ${rfq.product_description}
          </p>

          <p>
            <strong>Quantity:</strong>
            ${rfq.product_quantity}
          </p>

          <p>
            <strong>Amount:</strong>
            ${rfq.currency} ${amount}
          </p>

          <p>
            <strong>Status:</strong>
            Pending
          </p>

        </div>

        <p>
          Please log in to your PatchPay account to review the RFQ
          and respond to the request.
        </p>

        <div style="
          text-align: center;
          margin: 30px 0;
        ">
          <a
            href="${process.env.FRONTEND_URL}/rfq/${rfq.id}"
            style="
              display: inline-block;
              padding: 12px 24px;
              background-color: #111827;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            "
          >
            View RFQ
          </a>
        </div>

        <p>
          Thank you for using PatchPay.
        </p>

        <p>
          Regards,<br />
          <strong>PatchPay Team</strong>
        </p>

        <hr style="
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 30px 0;
        " />

        <small style="color: #777777;">
          This is an automated notification from PatchPay.
        </small>

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
  sendRFQNotificationEmail,
};