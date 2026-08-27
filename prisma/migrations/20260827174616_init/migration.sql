-- CreateEnum
CREATE TYPE "UserAccountType" AS ENUM ('Personal', 'Merchant');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('Active', 'Inactive');

-- CreateEnum
CREATE TYPE "WalletAccountType" AS ENUM ('personal', 'merchant', 'ngo', 'government');

-- CreateEnum
CREATE TYPE "WalletCurrency" AS ENUM ('NGN', 'GHS', 'KES', 'ZAR', 'EGP', 'UGX', 'TZS', 'RWF', 'ETB', 'XAF', 'XOF', 'DZD', 'MAD', 'GBP', 'EUR', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'USD', 'CAD', 'MXN', 'CNY', 'JPY', 'INR', 'SGD', 'AED', 'SAR', 'QAR', 'ILS', 'KRW', 'THB', 'MYR', 'IDR', 'PKR', 'PHP', 'VND', 'AUD', 'NZD', 'BRL', 'ARS', 'CLP', 'COP', 'PEN');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('transfer', 'deposit', 'withdrawal', 'invoice_payment', 'escrow_funding', 'escrow_release');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'success', 'completed', 'failed', 'reversed', 'pending_verification', 'processing');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('not_required', 'pending', 'verified', 'failed');

-- CreateEnum
CREATE TYPE "TransactionPaymentMethod" AS ENUM ('card', 'bank', 'wallet', 'cash');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('GTB', 'Switch', 'Internal', 'SquadCo');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('pending', 'successful', 'failed', 'reversed');

-- CreateEnum
CREATE TYPE "WithdrawalFlow" AS ENUM ('withdrawal', 'external_bank_transfer');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('initiated', 'pending', 'processing', 'success', 'successful', 'failed', 'reversed');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('CREATED', 'PARTIALLY_FUNDED', 'FUNDED', 'DELIVERED', 'RECEIVED', 'RELEASED', 'REFUNDED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EscrowTransactionType" AS ENUM ('FUND', 'RELEASE', 'REFUND');

-- CreateEnum
CREATE TYPE "EscrowTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('pending', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "InvoicePaymentStatus" AS ENUM ('unpaid', 'pending', 'paid', 'failed');

-- CreateEnum
CREATE TYPE "QuoteType" AS ENUM ('RFQ', 'Order');

-- CreateEnum
CREATE TYPE "QuoteCurrency" AS ENUM ('NGN', 'USD', 'GBP');

-- CreateEnum
CREATE TYPE "QuoteStatusValue" AS ENUM ('Pending', 'Accepted', 'Rejected', 'Cancelled', 'Funded', 'Completed');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('Standard', 'Secure');

-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('Domestic', 'International');

-- CreateEnum
CREATE TYPE "QuoteProgress" AS ENUM ('Pending', 'Completed', 'Rejected');

-- CreateEnum
CREATE TYPE "QuoteHistoryStatus" AS ENUM ('Pending', 'Accepted', 'Rejected', 'Cancelled', 'Deleted');

-- CreateEnum
CREATE TYPE "CouponUse" AS ENUM ('Amount_N', 'Percentage');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('Limit number of users', 'Unlimited');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('Pending', 'Accepted', 'Rejected');

-- CreateEnum
CREATE TYPE "DispatchType" AS ENUM ('Standard', 'Express');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('Bank Transfer', 'Card', 'Wallet');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('Escrow Funding', 'Escrow Release', 'Escrow Refund', 'Wallet Funding');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('Pending', 'Completed', 'Failed', 'Refunded');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('Requested', 'Processed', 'Rejected');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('success', 'error', 'info', 'warning');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('transfer', 'wallet', 'account', 'system');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('card', 'bank_transfer', 'squad_api');

-- CreateEnum
CREATE TYPE "PaymentVerificationStatus" AS ENUM ('pending', 'verified', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('Refund', 'Pending', 'Completed');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "account_type" "UserAccountType" NOT NULL,
    "status_client" "ClientStatus" NOT NULL DEFAULT 'Inactive',
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "transaction_pin_hash" TEXT,
    "reset_password_otp" TEXT,
    "has_transaction_pin" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "phone_number" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "otp" TEXT,
    "otp_expires" TIMESTAMP(3),
    "reset_password_token" TEXT,
    "reset_password_expires" TIMESTAMP(3),
    "notification" BOOLEAN NOT NULL DEFAULT false,
    "first_name" TEXT,
    "middle_name" TEXT,
    "surname" TEXT,
    "business_name" TEXT,
    "industry" TEXT,
    "company_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "account_type" "WalletAccountType" NOT NULL DEFAULT 'personal',
    "account_number" VARCHAR(50) NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" "WalletCurrency" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "TransactionStatus" NOT NULL DEFAULT 'pending',
    "sender_wallet" INTEGER,
    "sender_id" INTEGER,
    "recipient_wallet" INTEGER,
    "recipient_id" INTEGER,
    "reference" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "is_user_account_transfer" BOOLEAN NOT NULL DEFAULT true,
    "static_user_uprn" TEXT,
    "description" TEXT,
    "external_reference" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'not_required',
    "verification_id" INTEGER,
    "payment_method" "TransactionPaymentMethod" NOT NULL DEFAULT 'wallet',
    "payment_gateway" "PaymentGateway" NOT NULL DEFAULT 'Internal',
    "name_on_payment_method" TEXT,
    "failure_reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_payments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'NGN',
    "transaction_ref" TEXT NOT NULL,
    "squad_ref" TEXT,
    "status" "DepositStatus" NOT NULL DEFAULT 'pending',
    "gateway_response" JSONB,
    "gateway_response_code" TEXT,
    "transaction_id" INTEGER,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "error_message" TEXT,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposit_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_payments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "transaction_ref" TEXT NOT NULL,
    "squad_ref" TEXT,
    "idempotency_key" TEXT,
    "flow_type" "WithdrawalFlow" NOT NULL DEFAULT 'withdrawal',
    "bank_code" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'pending',
    "gateway_response" JSONB,
    "gateway_response_code" TEXT,
    "provider_responses" JSONB NOT NULL DEFAULT '[]',
    "audit_trail" JSONB NOT NULL DEFAULT '[]',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "error_message" TEXT,
    "error_code" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "transaction_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawal_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrows" (
    "id" SERIAL NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "current_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "EscrowStatus" NOT NULL DEFAULT 'CREATED',
    "escrow_uprn" TEXT NOT NULL,
    "funding_transaction_id" INTEGER,
    "release_transaction_id" INTEGER,
    "refund_transaction_id" INTEGER,
    "delivery_proof_url" TEXT,
    "delivery_proof_public_id" TEXT,
    "seller_delivered_at" TIMESTAMP(3),
    "buyer_received" BOOLEAN NOT NULL DEFAULT false,
    "buyer_received_at" TIMESTAMP(3),
    "conditions" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_transactions" (
    "id" SERIAL NOT NULL,
    "transaction_reference" TEXT NOT NULL,
    "escrow_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "EscrowTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "balance_after_transaction" DOUBLE PRECISION NOT NULL,
    "outstanding_balance_after_transaction" DOUBLE PRECISION NOT NULL,
    "original_amount" DOUBLE PRECISION NOT NULL,
    "status" "EscrowTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "rfq_id" INTEGER NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "description" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'pending',
    "payment_status" "InvoicePaymentStatus" NOT NULL DEFAULT 'unpaid',
    "payment_reference" TEXT,
    "squad_ref" TEXT,
    "checkout_url" TEXT,
    "paid_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "gateway_response" JSONB,
    "escrow_id" INTEGER,
    "funding_transaction_id" INTEGER,
    "escrow_funding_transaction_id" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" SERIAL NOT NULL,
    "quote_number" TEXT NOT NULL,
    "type" "QuoteType" NOT NULL,
    "product_description" TEXT NOT NULL,
    "product_quantity" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" "QuoteCurrency" NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "uprn" TEXT NOT NULL,
    "status" "QuoteStatusValue" NOT NULL DEFAULT 'Pending',
    "user_data" JSONB NOT NULL,
    "destinatary_user" JSONB NOT NULL,
    "delivery_code" INTEGER NOT NULL,
    "delivery_type" "DeliveryType" NOT NULL,
    "trade_type" "TradeType" NOT NULL,
    "delivery_address" JSONB NOT NULL,
    "arrival_date" TIMESTAMP(3) NOT NULL,
    "arrival_time" TEXT NOT NULL,
    "line_total" DOUBLE PRECISION NOT NULL,
    "delivery_charge" DOUBLE PRECISION NOT NULL,
    "transaction_charges" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "proof_delivery" INTEGER NOT NULL,
    "coupon" JSONB NOT NULL DEFAULT '[]',
    "exchange_rate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "response_notification_due" TIMESTAMP(3),
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "deletion_notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "invoice" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_statuses" (
    "id" SERIAL NOT NULL,
    "quote" INTEGER NOT NULL,
    "status" "QuoteProgress" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_histories" (
    "id" SERIAL NOT NULL,
    "quote" INTEGER NOT NULL,
    "user_data" JSONB NOT NULL,
    "status" "QuoteHistoryStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "notification_due" TIMESTAMP(3),
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "deletion_due" TIMESTAMP(3),
    "deletion_notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banks" (
    "id" SERIAL NOT NULL,
    "bank_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT DEFAULT 'NG',
    "active" BOOLEAN DEFAULT true,
    "raw" JSONB DEFAULT '{}',
    "last_synced_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" SERIAL NOT NULL,
    "addresses" JSONB NOT NULL,
    "user" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amounts" (
    "id" SERIAL NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "amounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balances" (
    "id" SERIAL NOT NULL,
    "balance" INTEGER NOT NULL,
    "available_balance" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "user" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bk_commissions" (
    "id" SERIAL NOT NULL,
    "uprn" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bk_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bk_rates" (
    "id" SERIAL NOT NULL,
    "code_transfer" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bk_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_details" (
    "id" SERIAL NOT NULL,
    "card_number" TEXT NOT NULL,
    "card_holder_name" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "cvv" TEXT NOT NULL,
    "billing_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" SERIAL NOT NULL,
    "commission_squad" DOUBLE PRECISION NOT NULL,
    "commission_stripe" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "totals" (
    "id" SERIAL NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "totals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_data" (
    "id" SERIAL NOT NULL,
    "commissions_national" INTEGER NOT NULL,
    "total_national" INTEGER NOT NULL,
    "commissions_international" INTEGER NOT NULL,
    "total_international" INTEGER NOT NULL,
    "rate_international_squad" DOUBLE PRECISION NOT NULL,
    "rate_international_stripe" DOUBLE PRECISION NOT NULL,
    "rate_national_squad" DOUBLE PRECISION NOT NULL,
    "rate_national_stripe" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "use" "CouponUse" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "type" "CouponType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "limit_users" INTEGER NOT NULL DEFAULT 0,
    "country" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_assignments" (
    "id" SERIAL NOT NULL,
    "user" INTEGER NOT NULL,
    "coupon" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_coupons" (
    "quote_id" INTEGER NOT NULL,
    "coupon_id" INTEGER NOT NULL,

    CONSTRAINT "quote_coupons_pkey" PRIMARY KEY ("quote_id","coupon_id")
);

-- CreateTable
CREATE TABLE "credit_my_account_bks" (
    "id" SERIAL NOT NULL,
    "amount" INTEGER NOT NULL,
    "uprn" TEXT NOT NULL,
    "user_ref" INTEGER NOT NULL,
    "status" "CreditStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_my_account_bks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatches" (
    "id" SERIAL NOT NULL,
    "type" "DispatchType" NOT NULL,
    "address" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "dispatch_recipient" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "user" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "transaction_reference" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'Pending',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" SERIAL NOT NULL,
    "payment" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'Requested',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_requests" (
    "id" SERIAL NOT NULL,
    "request_number" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "additional_info" TEXT NOT NULL DEFAULT '',
    "url_photo" JSONB NOT NULL DEFAULT '[]',
    "uprn" TEXT NOT NULL,
    "quote_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_question_sets" (
    "id" SERIAL NOT NULL,
    "questions" JSONB NOT NULL,
    "user" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_question_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "sender_id" INTEGER,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'info',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "category" "NotificationCategory" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_verifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "payment_method" "VerificationMethod" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "uprn" TEXT NOT NULL,
    "name_on_account" TEXT,
    "registered_name" TEXT,
    "name_verified" BOOLEAN NOT NULL DEFAULT true,
    "status" "PaymentVerificationStatus" NOT NULL DEFAULT 'pending',
    "external_reference" TEXT,
    "squad_ref" TEXT,
    "failure_reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "min_amounts" (
    "id" SERIAL NOT NULL,
    "squad" DOUBLE PRECISION NOT NULL,
    "stripe" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "min_amounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rates" (
    "id" SERIAL NOT NULL,
    "rate_international_squad" DOUBLE PRECISION NOT NULL,
    "rate_international_stripe" DOUBLE PRECISION NOT NULL,
    "rate_national_squad" DOUBLE PRECISION NOT NULL,
    "rate_national_stripe" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" SERIAL NOT NULL,
    "code_transfer" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL,
    "amount" TEXT NOT NULL,
    "user" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_account_number_key" ON "wallets"("account_number");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_payments_transaction_ref_key" ON "deposit_payments"("transaction_ref");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_payments_squad_ref_key" ON "deposit_payments"("squad_ref");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_payments_transaction_ref_key" ON "withdrawal_payments"("transaction_ref");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_payments_squad_ref_key" ON "withdrawal_payments"("squad_ref");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_payments_idempotency_key_key" ON "withdrawal_payments"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "escrows_escrow_uprn_key" ON "escrows"("escrow_uprn");

-- CreateIndex
CREATE INDEX "escrows_creator_id_created_at_idx" ON "escrows"("creator_id", "created_at");

-- CreateIndex
CREATE INDEX "escrows_recipient_id_status_idx" ON "escrows"("recipient_id", "status");

-- CreateIndex
CREATE INDEX "escrows_status_idx" ON "escrows"("status");

-- CreateIndex
CREATE INDEX "escrows_expiry_date_idx" ON "escrows"("expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_transactions_transaction_reference_key" ON "escrow_transactions"("transaction_reference");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_rfq_id_key" ON "invoices"("rfq_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payment_reference_key" ON "invoices"("payment_reference");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_squad_ref_key" ON "invoices"("squad_ref");

-- CreateIndex
CREATE INDEX "invoices_requester_id_created_at_idx" ON "invoices"("requester_id", "created_at");

-- CreateIndex
CREATE INDEX "invoices_recipient_id_created_at_idx" ON "invoices"("recipient_id", "created_at");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_payment_status_idx" ON "invoices"("payment_status");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_quote_number_key" ON "quotes"("quote_number");

-- CreateIndex
CREATE INDEX "quotes_status_response_notification_due_notification_sent_idx" ON "quotes"("status", "response_notification_due", "notification_sent");

-- CreateIndex
CREATE INDEX "quotes_status_updated_at_deletion_notification_sent_idx" ON "quotes"("status", "updated_at", "deletion_notification_sent");

-- CreateIndex
CREATE INDEX "quote_histories_notification_due_idx" ON "quote_histories"("notification_due");

-- CreateIndex
CREATE INDEX "quote_histories_deletion_due_idx" ON "quote_histories"("deletion_due");

-- CreateIndex
CREATE INDEX "quote_histories_quote_created_at_idx" ON "quote_histories"("quote", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "banks_bank_code_key" ON "banks"("bank_code");

-- CreateIndex
CREATE INDEX "banks_active_bank_code_idx" ON "banks"("active", "bank_code");

-- CreateIndex
CREATE UNIQUE INDEX "bk_rates_code_transfer_key" ON "bk_rates"("code_transfer");

-- CreateIndex
CREATE UNIQUE INDEX "card_details_card_number_key" ON "card_details"("card_number");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_reference_key" ON "payments"("transaction_reference");

-- CreateIndex
CREATE INDEX "payments_user_created_at_idx" ON "payments"("user", "created_at");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "refund_requests_request_number_key" ON "refund_requests"("request_number");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_created_at_idx" ON "notifications"("recipient_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_is_read_idx" ON "notifications"("recipient_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "payment_verifications_uprn_key" ON "payment_verifications"("uprn");

-- CreateIndex
CREATE INDEX "payment_verifications_user_id_created_at_idx" ON "payment_verifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_verifications_status_idx" ON "payment_verifications"("status");

-- CreateIndex
CREATE INDEX "payment_verifications_squad_ref_idx" ON "payment_verifications"("squad_ref");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_code_transfer_key" ON "transfers"("code_transfer");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_payments" ADD CONSTRAINT "deposit_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_payments" ADD CONSTRAINT "deposit_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_payments" ADD CONSTRAINT "withdrawal_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_payments" ADD CONSTRAINT "withdrawal_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_escrow_id_fkey" FOREIGN KEY ("escrow_id") REFERENCES "escrows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_escrow_id_fkey" FOREIGN KEY ("escrow_id") REFERENCES "escrows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_statuses" ADD CONSTRAINT "quote_statuses_quote_fkey" FOREIGN KEY ("quote") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_histories" ADD CONSTRAINT "quote_histories_quote_fkey" FOREIGN KEY ("quote") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_fkey" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balances" ADD CONSTRAINT "balances_balance_fkey" FOREIGN KEY ("balance") REFERENCES "amounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balances" ADD CONSTRAINT "balances_available_balance_fkey" FOREIGN KEY ("available_balance") REFERENCES "amounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balances" ADD CONSTRAINT "balances_user_fkey" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bk_commissions" ADD CONSTRAINT "bk_commissions_amount_fkey" FOREIGN KEY ("amount") REFERENCES "amounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bk_rates" ADD CONSTRAINT "bk_rates_amount_fkey" FOREIGN KEY ("amount") REFERENCES "amounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_data" ADD CONSTRAINT "financial_data_commissions_national_fkey" FOREIGN KEY ("commissions_national") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_data" ADD CONSTRAINT "financial_data_commissions_international_fkey" FOREIGN KEY ("commissions_international") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_data" ADD CONSTRAINT "financial_data_total_national_fkey" FOREIGN KEY ("total_national") REFERENCES "totals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_data" ADD CONSTRAINT "financial_data_total_international_fkey" FOREIGN KEY ("total_international") REFERENCES "totals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_assignments" ADD CONSTRAINT "coupon_assignments_user_fkey" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_assignments" ADD CONSTRAINT "coupon_assignments_coupon_fkey" FOREIGN KEY ("coupon") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_coupons" ADD CONSTRAINT "quote_coupons_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_coupons" ADD CONSTRAINT "quote_coupons_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_my_account_bks" ADD CONSTRAINT "credit_my_account_bks_amount_fkey" FOREIGN KEY ("amount") REFERENCES "amounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_my_account_bks" ADD CONSTRAINT "credit_my_account_bks_user_ref_fkey" FOREIGN KEY ("user_ref") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_fkey" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_fkey" FOREIGN KEY ("payment") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_fkey" FOREIGN KEY ("amount") REFERENCES "amounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_quote_number_fkey" FOREIGN KEY ("quote_number") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_question_sets" ADD CONSTRAINT "security_question_sets_user_fkey" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_verifications" ADD CONSTRAINT "payment_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_user_fkey" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
