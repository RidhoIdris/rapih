import type { Receipt } from '@rapih/db';
import type { ReceiptDto } from '@rapih/shared';

export function receiptToDto(row: Receipt): ReceiptDto {
  return {
    id: row.id,
    image_url: row.image_url ?? null,
    merchant_name: row.merchant_name ?? null,
    total_amount: row.total_amount !== null ? row.total_amount.toString() : null,
    scanned_at: row.scanned_at.toISOString(),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
