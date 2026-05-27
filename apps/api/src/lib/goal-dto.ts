import type { Goal } from '@rapih/db';
import type { GoalDto } from '@rapih/shared';

export function goalToDto(row: Goal): GoalDto {
  const target = row.target_amount;
  const saved = row.saved_amount;
  const progress = target === 0n ? 0 : Math.min(1, Number(saved) / Number(target));

  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    target_amount: target.toString(),
    saved_amount: saved.toString(),
    progress,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    wallet_id: row.wallet_id ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
