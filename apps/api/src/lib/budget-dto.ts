import type { Budget } from '@rapih/db';
import type { BudgetDto } from '@rapih/shared';

type BudgetWithCategories = Budget & { budget_categories: { category_id: string }[] };

export function budgetToDto(row: BudgetWithCategories, spent: bigint): BudgetDto {
  const categoryIds = row.budget_categories.map((bc) => bc.category_id);
  const amount = row.amount;
  const remaining = amount - spent;
  const progress = amount === 0n ? 0 : Math.min(1, Number(spent) / Number(amount));
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    amount: amount.toString(),
    category_ids: categoryIds,
    spent: spent.toString(),
    remaining: remaining.toString(),
    progress,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
