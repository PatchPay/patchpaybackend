// Reconcile legacy wallets whose available balance included escrow-held funds,
// then enforce that spendable funds can never exceed total wallet funds.
const sequelize = require("../config/database");

async function run() {
  await sequelize.authenticate();
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`
      UPDATE wallets
      SET available_balance = LEAST(available_balance, balance), updated_at = NOW()
      WHERE available_balance > balance
    `, { transaction });

    await sequelize.query(`
      DO $$ BEGIN
        ALTER TABLE wallets ADD CONSTRAINT wallets_available_lte_balance
          CHECK (available_balance <= balance);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `, { transaction });
  });
  console.log("Wallet balance reservation invariant is ready.");
}

run().catch((error) => {
  console.error("Wallet reservation migration failed:", error.message);
  process.exitCode = 1;
}).finally(async () => sequelize.close());
