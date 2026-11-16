// Add the display balance to the existing wallet ledger without changing
// spendable funds. Outstanding funded escrow is added back to the wallet's
// current internal balance to recover the pre-escrow available amount.
const sequelize = require("../config/database");

async function run() {
  await sequelize.authenticate();
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`
      ALTER TABLE wallets
      ADD COLUMN IF NOT EXISTS available_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00
    `, { transaction });

    await sequelize.query(`
      WITH held AS (
        SELECT recipient_id AS user_id, UPPER(currency) AS currency,
               SUM(GREATEST(COALESCE(current_balance, 0), 0)) AS amount
        FROM escrows
        WHERE status IN ('PARTIALLY_FUNDED', 'FUNDED', 'DELIVERED', 'RECEIVED', 'DISPUTED', 'CANCELLED')
          AND COALESCE(current_balance, 0) > 0
        GROUP BY recipient_id, UPPER(currency)
      )
      UPDATE wallets w
      SET available_balance = GREATEST(w.balance + COALESCE(h.amount, 0), 0),
          updated_at = NOW()
      FROM (SELECT w0.id, h.amount FROM wallets w0
            LEFT JOIN held h ON h.user_id = w0.user_id AND h.currency = UPPER(w0.currency)) h
      WHERE w.id = h.id
    `, { transaction });

    await sequelize.query(`
      DO $$ BEGIN
        ALTER TABLE wallets ADD CONSTRAINT wallets_available_balance_nonnegative
          CHECK (available_balance >= 0);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `, { transaction });
  });
  console.log("Wallet available balances are ready.");
}

run().catch((error) => {
  console.error("Wallet available balance migration failed:", error.message);
  process.exitCode = 1;
}).finally(async () => sequelize.close());
