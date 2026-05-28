-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'receipt_ready';
ALTER TYPE "NotificationKind" ADD VALUE 'receipt_failed';

-- CreateEnum
CREATE TYPE "ReceiptScanStatus" AS ENUM ('pending', 'processing', 'ready', 'consumed', 'failed');

-- CreateEnum
CREATE TYPE "ReceiptScanSource" AS ENUM ('in_app', 'share_intent');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "receipt_scan_id" TEXT;

-- CreateTable
CREATE TABLE "receipt_scans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" "ReceiptScanSource" NOT NULL,
    "status" "ReceiptScanStatus" NOT NULL DEFAULT 'pending',
    "r2_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "ocr_result" JSONB,
    "failed_reason" TEXT,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "receipt_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receipt_scans_user_id_deleted_at_created_at_idx" ON "receipt_scans"("user_id", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "transactions_receipt_scan_id_idx" ON "transactions"("receipt_scan_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receipt_scan_id_fkey" FOREIGN KEY ("receipt_scan_id") REFERENCES "receipt_scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_scans" ADD CONSTRAINT "receipt_scans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
