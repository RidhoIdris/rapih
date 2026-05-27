import type { RecurringTransaction } from '@rapih/db';
import type { RecurringDto } from '@rapih/shared';

export function recurringToDto(row: RecurringTransaction): RecurringDto {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    kind: row.kind as RecurringDto['kind'],
    wallet_id: row.wallet_id,
    category_id: row.category_id,
    amount: row.amount.toString(),
    note: row.note ?? null,
    period: row.period,
    next_due_date: row.next_due_date.toISOString(),
    last_paid_at: row.last_paid_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
