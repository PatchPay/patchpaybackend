const fs = require("fs");
const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const routeMounts = {
  userRoutes: "/api/users", walletRoutes: "/api/wallet", paymentRoutes: "/api/payments",
  rfqRoutes: "/api/rfq", invoiceRoutes: "/api/invoices", escrowRoutes: "/api/escrow",
  escrowTransactionRoutes: "/api/escrow-transactions", notificationRoutes: "/api/notifications",
  transactionRoutes: "/api/transactions", transferRoutes: "/api/transfers",
  depositRoutes: "/api/payments/deposit", withdrawalRoutes: "/api/payments/withdrawal",
};

const tagForRoute = (name) => ({
  userRoutes: "Users", walletRoutes: "Wallets", paymentRoutes: "Payments", depositRoutes: "Payments",
  withdrawalRoutes: "Payments", rfqRoutes: "RFQs", invoiceRoutes: "Invoices", escrowRoutes: "Escrow",
  escrowTransactionRoutes: "Escrow Transactions", notificationRoutes: "Notifications",
  transactionRoutes: "Transactions", transferRoutes: "Transfers",
}[name]);

const protectedRoute = (name, endpoint) => ![
  "userRoutes:/test", "userRoutes:/test-email", "userRoutes:/register", "userRoutes:/login",
  "userRoutes:/verify-email", "userRoutes:/resend-otp", "userRoutes:/test-login", "userRoutes:/test-register",
  "userRoutes:/verify-email-page", "userRoutes:/forget-password", "userRoutes:/reset-password",
  "invoiceRoutes:/callback", "invoiceRoutes:/verify-payment", "depositRoutes:/callback", "depositRoutes:/verify",
  "depositRoutes:/webhook", "withdrawalRoutes:/webhook",
].includes(`${name}:${endpoint}`);

const schemaForTag = (tag) => ({
  Users: "User", Wallets: "Wallet", Payments: "Payment", RFQs: "RFQ", Invoices: "Invoice",
  Escrow: "Escrow", "Escrow Transactions": "EscrowTransaction", Notifications: "Notification",
  Transactions: "Transaction", Transfers: "Transfer",
}[tag] || "SuccessResponse");

// Build paths from the router declarations themselves. This makes the docs stay in
// lock-step with Express routes without altering routing behaviour.
const paths = {};
for (const [routeFile, mount] of Object.entries(routeMounts)) {
  const sourcePath = path.join(__dirname, "routes", `${routeFile}.js`);
  const source = fs.readFileSync(sourcePath, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const matcher = /router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(matcher)) {
    const method = match[1];
    const endpoint = match[2];
    const openApiPath = `${mount}${endpoint}`.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    const tag = tagForRoute(routeFile);
    const operation = {
      tags: [tag],
      summary: `${method.toUpperCase()} ${endpoint}`,
      description: `Handles the ${method.toUpperCase()} ${endpoint} ${tag.toLowerCase()} endpoint.`,
      responses: {
        200: { description: "Request completed successfully", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        404: { $ref: "#/components/responses/NotFound" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    };
    const parameterNames = [...endpoint.matchAll(/:([A-Za-z0-9_]+)/g)].map((item) => item[1]);
    if (parameterNames.length) operation.parameters = parameterNames.map((name) => ({ name, in: "path", required: true, description: `${name} identifier`, schema: { type: "integer", example: 1 } }));
    if (["post", "put", "patch"].includes(method)) {
      operation.requestBody = { required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaForTag(tag)}` } } } };
      operation.responses[201] = { description: "Resource created", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } };
    }
    if (protectedRoute(routeFile, endpoint)) operation.security = [{ bearerAuth: [] }];
    paths[openApiPath] = { ...(paths[openApiPath] || {}), [method]: operation };
  }
}

const entity = (description, properties, required = []) => ({ type: "object", description, required, properties });
const options = {
  definition: {
    openapi: "3.0.0",
    info: { title: "PatchPay API", version: "1.0.0", description: "Production REST API for PatchPay." },
    servers: [
        { url: "http://localhost:5000", description: "Development server" },
          {
    url: "https://patchpaybackend.onrender.com",
    description: "Production Server",
  },

    ],
    tags: ["Users", "Wallets", "Payments", "RFQs", "Invoices", "Escrow", "Escrow Transactions", "Notifications", "Transactions", "Transfers"].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "JWT returned by the login endpoint." } },
      responses: {
        BadRequest: { description: "Invalid request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        Unauthorized: { description: "Authentication required", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        Forbidden: { description: "Permission denied", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        NotFound: { description: "Resource not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        ServerError: { description: "Unexpected server error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      },
      schemas: {
        ErrorResponse: entity("Standard error response.", { success: { type: "boolean", description: "Whether the request succeeded.", example: false }, message: { type: "string", description: "Human-readable error message.", example: "Invalid request" }, error: { type: "string", description: "Optional technical error detail." } }, ["success", "message"]),
        SuccessResponse: entity("Standard successful response.", { success: { type: "boolean", description: "Whether the request succeeded.", example: true }, message: { type: "string", description: "Human-readable result message." }, data: { description: "Endpoint-specific response payload." } }, ["success"]),
        User: entity("PatchPay user account.", { id: { type: "integer", description: "User identifier.", example: 1 }, email: { type: "string", format: "email", description: "User email address.", example: "john@example.com" }, password: { type: "string", format: "password", description: "Account password.", example: "password123" }, accountType: { type: "string", description: "Account classification.", enum: ["Personal", "Merchant", "NGO", "Government"] }, firstName: { type: "string", description: "Given name." }, surname: { type: "string", description: "Family name." }, phoneNumber: { type: "string", description: "Phone number." } }, ["email"]),
        Wallet: entity("Currency wallet.", { id: { type: "integer", description: "Wallet identifier." }, userId: { type: "integer", description: "Owner user identifier." }, accountNumber: { type: "string", description: "Wallet account number." }, balance: { type: "number", format: "float", description: "Available balance." }, currency: { type: "string", description: "ISO currency code.", example: "NGN" } }),
        Payment: entity("Payment record.", { id: { type: "integer", description: "Payment identifier." }, amount: { type: "number", description: "Payment amount." }, currency: { type: "string", description: "Payment currency." }, status: { type: "string", description: "Payment status." } }),
        RFQ: entity("Request for quotation.", { recipientId: { type: "integer", description: "Recipient user identifier." }, product_description: { type: "string", description: "Requested product description." }, product_quantity: { type: "integer", description: "Requested quantity." }, amount: { type: "number", description: "Unit amount." }, currency: { type: "string", description: "Currency code." } }),
        Quote: entity("Quote response.", { id: { type: "integer", description: "Quote identifier." }, quote_number: { type: "string", description: "Human-readable quote number." }, status: { type: "string", description: "Quote lifecycle state.", enum: ["Pending", "Accepted", "Rejected", "Cancelled"] }, total: { type: "number", description: "Quote total." } }),
        Invoice: entity("Invoice for an accepted quote.", { id: { type: "integer", description: "Invoice identifier." }, rfqId: { type: "integer", description: "Related quote identifier." }, amount: { type: "number", description: "Invoice amount." }, currency: { type: "string", description: "Invoice currency." }, paymentStatus: { type: "string", description: "Payment state.", enum: ["unpaid", "pending", "paid", "failed"] } }),
        Escrow: entity("Escrow holding record.", { id: { type: "integer", description: "Escrow identifier." }, creatorId: { type: "integer", description: "Creator identifier." }, recipientId: { type: "integer", description: "Recipient identifier." }, amount: { type: "number", description: "Escrow amount." }, currency: { type: "string", description: "Escrow currency." }, status: { type: "string", description: "Escrow state.", enum: ["CREATED", "PARTIALLY_FUNDED", "FUNDED", "RELEASED", "REFUNDED", "DISPUTED", "CANCELLED"] } }),
        EscrowTransaction: entity("Movement of funds within an escrow.", { id: { type: "integer", description: "Escrow transaction identifier." }, escrowId: { type: "integer", description: "Related escrow identifier." }, amount: { type: "number", description: "Transaction amount." }, type: { type: "string", description: "Movement type.", enum: ["FUND", "RELEASE", "REFUND"] }, status: { type: "string", description: "Processing state.", enum: ["PENDING", "COMPLETED", "FAILED"] } }),
        Notification: entity("User notification.", { id: { type: "integer", description: "Notification identifier." }, recipientId: { type: "integer", description: "Recipient identifier." }, title: { type: "string", description: "Notification title." }, message: { type: "string", description: "Notification body." }, isRead: { type: "boolean", description: "Whether the notification has been read." } }),
        Transaction: entity("Account transaction.", { id: { type: "integer", description: "Transaction identifier." }, amount: { type: "number", description: "Transaction amount." }, currency: { type: "string", description: "Transaction currency." }, status: { type: "string", description: "Transaction status." }, reference: { type: "string", description: "Unique transaction reference." } }),
        Transfer: entity("Transfer request.", { accountNumber: { type: "string", description: "Destination account number." }, amount: { type: "number", description: "Amount to transfer." }, currency: { type: "string", description: "Transfer currency." }, transactionPin: { type: "string", description: "Transaction authorisation PIN." } }),
      },
    },
  },
  apis: ["./routes/*.js"],
};

module.exports = swaggerJsdoc(options);
