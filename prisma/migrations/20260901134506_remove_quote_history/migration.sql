/*
  Warnings:

  - You are about to drop the `quote_histories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `quote_statuses` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "quote_histories" DROP CONSTRAINT "quote_histories_quote_fkey";

-- DropForeignKey
ALTER TABLE "quote_statuses" DROP CONSTRAINT "quote_statuses_quote_fkey";

-- DropTable
DROP TABLE "quote_histories";

-- DropTable
DROP TABLE "quote_statuses";
