// Add a currency-specific account balance ledger. Existing wallet balances and
// wallet identifiers are deliberately left untouched: they remain the wallet
// balance, while every existing user starts with a zero account balance.
const sequelize = require("../config/database");

async function run() {
  await sequelize.authenticate();
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS account_balances (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
      currency VARCHAR(10) NOT NULL,
      balance DECIMAL(15,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT account_balances_user_currency_unique UNIQUE (user_id, currency)
    )
  `);
  // Preserve one independent zero account balance for every existing wallet currency.
  await sequelize.query(`
    INSERT INTO account_balances (user_id, currency)
    SELECT id, 'NGN' FROM users
    UNION
    SELECT user_id, currency FROM wallets
    ON CONFLICT (user_id, currency) DO NOTHING
  `);
  await sequelize.query(`ALTER TYPE "enum_transactions_type" ADD VALUE IF NOT EXISTS 'account_to_wallet'`);
  await sequelize.query(`ALTER TYPE "enum_transactions_type" ADD VALUE IF NOT EXISTS 'wallet_to_account'`);
  await sequelize.query(`ALTER TYPE "enum_transactions_type" ADD VALUE IF NOT EXISTS 'escrow_refund'`);
  console.log("Separate account balances are ready.");
}

run().catch((error) => {
  console.error("Account balance migration failed:", error.message);
  process.exitCode = 1;
}).finally(async () => sequelize.close());
