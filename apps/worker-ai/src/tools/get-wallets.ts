import { z } from 'zod';
import type { ToolDef } from './types.js';

const Args = z.object({});

export const getWalletsTool: ToolDef<z.infer<typeof Args>> = {
  name: 'get_wallets',
  description: "Return the current user's wallets (dompet) with live balances.",
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  argsSchema: Args,
  async run(_args, { userId, prisma }) {
    const wallets = await prisma.wallet.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { created_at: 'asc' },
    });
    const balances = await Promise.all(
      wallets.map(async (w) => {
        const [credits, debits] = await Promise.all([
          prisma.transaction.aggregate({
            where: {
              deleted_at: null,
              OR: [
                { wallet_id: w.id, kind: 'income' },
                { to_wallet_id: w.id, kind: 'transfer' },
              ],
            },
            _sum: { amount: true },
          }),
          prisma.transaction.aggregate({
            where: {
              wallet_id: w.id,
              deleted_at: null,
              kind: { in: ['expense', 'transfer'] },
            },
            _sum: { amount: true },
          }),
        ]);
        return w.initial_balance + (credits._sum.amount ?? 0n) - (debits._sum.amount ?? 0n);
      })
    );
    return {
      wallets: wallets.map((w, i) => ({
        id: w.id,
        name: w.label ?? w.provider_name,
        kind: w.kind,
        balance: (balances[i] ?? 0n).toString(),
      })),
    };
  },
};
