-- AlterTable
ALTER TABLE "recurring_transactions"
  ADD COLUMN "total_occurrences" INTEGER,
  ADD COLUMN "occurrences_paid" INTEGER NOT NULL DEFAULT 0;
