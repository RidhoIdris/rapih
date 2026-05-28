import { z } from 'zod';
import type { ToolDef } from './types.js';

const Args = z.object({
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  kind: z.enum(['income', 'expense']).optional(),
});

export const listTransactionsTool: ToolDef<z.infer<typeof Args>> = {
  name: 'list_transactions',
  description:
    'List the current user transactions in reverse chronological order. Money fields returned as Rupiah integer strings.',
  parameters: {
    type: 'object',
    properties: {
      since: { type: 'string', description: 'Inclusive ISO date (YYYY-MM-DD).' },
      until: { type: 'string', description: 'Inclusive ISO date (YYYY-MM-DD).' },
      limit: { type: 'number', description: 'Cap on rows (1-50). Default 20.' },
      kind: { type: 'string', enum: ['income', 'expense'] },
    },
    additionalProperties: false,
  },
  argsSchema: Args,
  async run(args, { userId, prisma }) {
    const limit = Math.min(args.limit ?? 20, 50);
    const where: Record<string, unknown> = {
      user_id: userId,
      deleted_at: null,
      ...(args.kind ? { kind: args.kind } : {}),
    };
    if (args.since || args.until) {
      const range: { gte?: Date; lte?: Date } = {};
      if (args.since) range.gte = new Date(args.since);
      if (args.until) {
        const end = new Date(args.until);
        end.setHours(23, 59, 59, 999);
        range.lte = end;
      }
      where.transacted_at = range;
    }
    const rows = await prisma.transaction.findMany({
      where,
      take: limit,
      orderBy: { transacted_at: 'desc' },
      include: { category: true, wallet: true },
    });
    return {
      transactions: rows.map((t) => ({
        id: t.id,
        transacted_at: t.transacted_at.toISOString(),
        kind: t.kind,
        amount: t.amount.toString(),
        category_name: t.category?.name ?? null,
        note: t.note ?? null,
        wallet_name: t.wallet.label ?? t.wallet.provider_name,
      })),
    };
  },
};
