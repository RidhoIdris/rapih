import { z } from 'zod';
import type { ToolDef } from './types.js';

const Args = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'must be YYYY-MM'),
});

function monthRange(month: string): { gte: Date; lt: Date } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const m = Number(monthStr) - 1;
  return { gte: new Date(year, m, 1), lt: new Date(year, m + 1, 1) };
}

export const summarizeMonthTool: ToolDef<z.infer<typeof Args>> = {
  name: 'summarize_month',
  description:
    'Summarize the user transactions for a given month: total income, total expense, net, and expense by category.',
  parameters: {
    type: 'object',
    properties: {
      month: { type: 'string', description: 'Format YYYY-MM, e.g. 2026-05.' },
    },
    required: ['month'],
    additionalProperties: false,
  },
  argsSchema: Args,
  async run(args, { userId, prisma }) {
    const range = monthRange(args.month);
    const rows = await prisma.transaction.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        transacted_at: { gte: range.gte, lt: range.lt },
      },
      include: { category: true },
    });
    let income = 0n;
    let expense = 0n;
    const byCat = new Map<string, { name: string; total: bigint }>();
    for (const t of rows) {
      if (t.kind === 'income') income += t.amount;
      else if (t.kind === 'expense') {
        expense += t.amount;
        const key = t.category_id ?? 'uncategorized';
        const name = t.category?.name ?? 'Lainnya';
        const entry = byCat.get(key) ?? { name, total: 0n };
        entry.total += t.amount;
        byCat.set(key, entry);
      }
    }
    const by_category = [...byCat.values()]
      .sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0))
      .map((c) => ({ name: c.name, total: c.total.toString() }));
    return {
      income: income.toString(),
      expense: expense.toString(),
      net: (income - expense).toString(),
      by_category,
    };
  },
};
