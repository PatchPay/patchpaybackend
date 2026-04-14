const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import Routes
const userRoutes = require("./routes/userRoutes");
const walletRoutes = require("./routes/walletRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const rfqRoutes = require("./routes/rfqRoutes");
const escrowRoutes = require("./routes/escrowRoutes");
const escrowTransactionRoutes = require("./routes/escrowTransactionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

// Import Cron Jobs
const startQuoteNotificationCron = require("./cron/quoteNotifications");
const startEscrowExpiryCron = require("./cron/escrowExpiry");

const app = express();
const PORT = process.env.PORT || 5000;

// Log environment variables (redacted for security)
console.log("Environment loaded:");
console.log("- MONGO_URI:", process.env.MONGO_URI ? "[SET]" : "[NOT SET]");
console.log("- JWT_SECRET:", process.env.JWT_SECRET ? "[SET]" : "[NOT SET]");
console.log("- PORT:", process.env.PORT || 5000);
console.log("- NODE_ENV:", process.env.NODE_ENV || "development");
console.log(
  "- SQUAD_SECRET_KEY:",
  process.env.SQUAD_SECRET_KEY ? "[SET]" : "[NOT SET]",
);

// Middleware

app.use(cors());
// ⚠️ Webhook raw body MUST be before express.json()
app.use(
  "/api/payments/deposit/webhook",
  express.raw({ type: "application/json" }),
);
app.use(express.json()); // Replaces bodyParser.json()
app.use(express.urlencoded({ extended: true })); // Parses form data

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected to Atlas"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Import User Model
const User = require("./models/User"); // Fixed model import path

// Mount Routes
app.use("/api/users", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/rfq", rfqRoutes);
app.use("/api/escrow", escrowRoutes);
app.use("/api/escrow-transactions", escrowTransactionRoutes);
app.use("/api/notifications", notificationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to PatchPay API",
    routes: {
      users: "/api/users",
      wallet: "/api/wallet",
      payments: "/api/payments",
      rfq: "/api/rfq",
      escrow: "/api/escrow",
      escrowTransactions: "/api/escrow-transactions",
      notifications: "/api/notifications",
    },
  });
});

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);

  // Start cron jobs
  startQuoteNotificationCron();
  console.log("📅 Quote notification cron job started");

  startEscrowExpiryCron();
  console.log("⏰ Escrow expiry cron job started");
});
