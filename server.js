const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const axios = require("axios");
const path = require("path");
require("dotenv").config();
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

const sequelize = require("./config/database");
require("./models");

// Routes
const userRoutes = require("./routes/userRoutes");
const walletRoutes = require("./routes/walletRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const rfqRoutes = require("./routes/rfqRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const escrowRoutes = require("./routes/escrowRoutes");
const escrowTransactionRoutes = require("./routes/escrowTransactionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const transferRoutes = require("./routes/transferRoutes");

// Services
const bankService = require("./services/bankService");

// Cron Jobs
const startQuoteNotificationCron = require("./cron/quoteNotifications");
const startEscrowExpiryCron = require("./cron/escrowExpiry");

const app = express();
const PORT = process.env.PORT || 5000;

console.log(
  "- SQUAD_SECRET_KEY:",
  process.env.SQUAD_SECRET_KEY ? "[SET]" : "[NOT SET]"
);

/* ===========================
   MIDDLEWARE
=========================== */

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(morgan("dev"));

// Webhook must use raw body BEFORE express.json()
app.use(
  "/api/payments/deposit/webhook",
  express.raw({ type: "application/json" })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ===========================
   ROOT / HEALTH ROUTES
=========================== */

app.get("/", (req, res) => {
  res.send("🚀 PatchPay Backend is running...");
});

app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🚀 PatchPay API is ready.",
    status: "OK",
    version: "v1",
  });
});

/* ===========================
   TEST ROUTE
=========================== */

app.get("/squad-balance", async (req, res) => {
  try {
    const response = await axios.get(
      "https://sandbox-api-d.squadco.com/merchant/balance",
      {
        headers: {
          Authorization: `Bearer ${process.env.SQUAD_SECRET_KEY}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);

/* ===========================
   API ROUTES
=========================== */

app.use("/api/users", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/rfq", rfqRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/escrow", escrowRoutes);
app.use("/api/escrow-transactions", escrowTransactionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/transfers", transferRoutes);

/* ===========================
   ERROR HANDLING
=========================== */

app.use((err, req, res, next) => {
  console.error("Unhandled request error:", err);

  return res.status(err.status || err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

/* ===========================
   404
=========================== */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/* ===========================
   START SERVER
=========================== */

async function startServer() {
  try {
    await sequelize.authenticate();

    console.log("✅ PostgreSQL Connected");

  await sequelize.sync();

console.log("✅ Database synchronized");

    await bankService
      .syncBanksFromSquad()
      .then(() => console.log("✅ Squad bank list synced"))
      .catch((err) =>
        console.warn("⚠️ Failed to sync banks:", err.message)
      );

    startQuoteNotificationCron();
    console.log("📅 Quote notification cron started");

    startEscrowExpiryCron();
    console.log("⏰ Escrow expiry cron started");

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Database Connection Error:", err);
  }
}

startServer();
