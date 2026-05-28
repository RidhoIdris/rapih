import { z } from 'zod';
import type { ToolDef } from './types.js';

const Args = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'must be YYYY-MM')
    .optional(),
});

function monthRange(month: string | undefined): { gte: Date; lt: Date } {
  let year: number;
  let m: number;
  if (month) {
    const [y, mm] = month.split('-');
    year = Number(y);
    m = Number(mm) - 1;
  } else {
    const now = new Date();
    year = now.getFullYear();
    m = now.getMonth();
  }
  return { gte: new Date(year, m, 1), lt: new Date(year, m + 1, 1) };
}

export const getBudgetsTool: ToolDef<z.infer<typeof Args>> = {
  name: 'get_budgets',
  description:
    "Return the current user's budgets for the given month (defaults to current month). Each item includes the configured amount and the live spent total.",
  parameters: {
    type: 'object',
    properties: {
      month: { type: 'string', description: 'YYYY-MM. Optional; defaults to current.' },
    },
    additionalProperties: false,
  },
  argsSchema: Args,
  async run(args, { userId, prisma }) {
    const range = monthRange(args.month);
    const [budgets, expenses] = await Promise.all([
      prisma.budget.findMany({
        where: { user_id: userId, deleted_at: null },
        include: { budget_categories: true },
        orderBy: { created_at: 'asc' },
      }),
      prisma.transaction.findMany({
        where: {
          user_id: userId,
          deleted_at: null,
          kind: 'expense',
          transacted_at: { gte: range.gte, lt: range.lt },
        },
        select: { category_id: true, amount: true },
      }),
    ]);
    const result = budgets.map((b) => {
      const catSet = new Set(b.budget_categories.map((bc) => bc.category_id));
      const spent = expenses
        .filter((t) => catSet.size === 0 || (t.category_id !== null && catSet.has(t.category_id)))
        .reduce((acc, t) => acc + t.amount, 0n);
      const remaining = b.amount - spent;
      return {
        name: b.name,
        amount: b.amount.toString(),
        spent: spent.toString(),
        remaining: remaining.toString(),
      };
    });
    return { budgets: result };
  },
};
