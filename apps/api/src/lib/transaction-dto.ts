import type { Transaction } from '@rapih/db';
import type { TransactionDto } from '@rapih/shared';

export function transactionToDto(row: Transaction): TransactionDto {
  return {
    id: row.id,
    kind: row.kind,
    wallet_id: row.wallet_id,
    to_wallet_id: row.to_wallet_id ?? null,
    category_id: row.category_id ?? null,
    amount: row.amount.toString(),
    note: row.note ?? null,
    transacted_at: row.transacted_at.toISOString(),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
