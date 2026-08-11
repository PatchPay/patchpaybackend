/**
 * One-time, idempotent migration: escrow delivery-proof + auto-release.
 *
 * WHY THIS IS NEEDED
 * ------------------
 * The app boots with `sequelize.sync()` (no `alter`, no migration runner).
 * `sync()` creates missing tables but does NOT add new columns/enum values to
 * tables that already exist. Because models/Escrow.js now SELECTs the new
 * delivery-proof columns on every read, an un-migrated existing database would
 * throw on any escrow query. Run this ONCE against each existing database
 * BEFORE deploying the new code. Fresh databases are covered by `sync()` and do
 * not need this script (running it anyway is harmless — every statement is
 * guarded with IF NOT EXISTS).
 *
 * WHAT IT DOES (all additive, all idempotent)
 *   - enum_escrows_status  += 'DELIVERED', 'RECEIVED'
 *   - enum_quotes_status   += 'Funded', 'Completed'
 *   - escrows table        += delivery_proof_url, delivery_proof_public_id,
 *                             seller_delivered_at, buyer_received, buyer_received_at
 *
 * USAGE
 *   node migrations/20260811-escrow-delivery-proof.js
 *
 * NOTE ON ENUMS
 *   Postgres forbids using a newly added enum value inside the same
 *   transaction that adds it, and `ALTER TYPE ... ADD VALUE` cannot run inside
 *   a transaction block at all. We therefore run the ADD VALUE statements in
 *   autocommit mode (plain sequelize.query, no managed transaction).
 */

const sequelize = require("../config/database");

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_name = :table
        AND column_name = :column
      LIMIT 1`,
    { replacements: { table, column } }
  );
  return rows.length > 0;
}

async function run() {
  console.log("▶ Running escrow delivery-proof migration...");

  await sequelize.authenticate();

  // 1. Enum values — autocommit, one statement at a time. ADD VALUE IF NOT
  //    EXISTS is a no-op when the value is already present (Postgres 10+).
  const enumStatements = [
    `ALTER TYPE "enum_escrows_status" ADD VALUE IF NOT EXISTS 'DELIVERED'`,
    `ALTER TYPE "enum_escrows_status" ADD VALUE IF NOT EXISTS 'RECEIVED'`,
    `ALTER TYPE "enum_quotes_status" ADD VALUE IF NOT EXISTS 'Funded'`,
    `ALTER TYPE "enum_quotes_status" ADD VALUE IF NOT EXISTS 'Completed'`,
  ];

  for (const stmt of enumStatements) {
    try {
      await sequelize.query(stmt);
      console.log(`  ✓ ${stmt}`);
    } catch (error) {
      // If the enum type itself doesn't exist yet (fresh DB before sync), skip.
      console.warn(`  ⚠ Skipped (${error.message}): ${stmt}`);
    }
  }

  // 2. Columns on the escrows table — additive + idempotent.
  const columnStatements = [
    `ALTER TABLE "escrows" ADD COLUMN IF NOT EXISTS "delivery_proof_url" TEXT`,
    `ALTER TABLE "escrows" ADD COLUMN IF NOT EXISTS "delivery_proof_public_id" VARCHAR(255)`,
    `ALTER TABLE "escrows" ADD COLUMN IF NOT EXISTS "seller_delivered_at" TIMESTAMPTZ`,
    `ALTER TABLE "escrows" ADD COLUMN IF NOT EXISTS "buyer_received" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "escrows" ADD COLUMN IF NOT EXISTS "buyer_received_at" TIMESTAMPTZ`,
  ];

  for (const stmt of columnStatements) {
    await sequelize.query(stmt);
    console.log(`  ✓ ${stmt}`);
  }

  // 3. Report final state.
  const cols = [
    "delivery_proof_url",
    "delivery_proof_public_id",
    "seller_delivered_at",
    "buyer_received",
    "buyer_received_at",
  ];
  for (const c of cols) {
    const present = await columnExists("escrows", c);
    console.log(`  escrows.${c}: ${present ? "present" : "MISSING"}`);
  }

  console.log("✅ Migration complete.");
}

run()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("❌ Migration failed:", error.message);
    try {
      await sequelize.close();
    } catch (_) {
      /* ignore */
    }
    process.exit(1);
  });
