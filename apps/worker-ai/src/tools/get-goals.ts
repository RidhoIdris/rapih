import { z } from 'zod';
import type { ToolDef } from './types.js';

const Args = z.object({});

export const getGoalsTool: ToolDef<z.infer<typeof Args>> = {
  name: 'get_goals',
  description:
    "Return the current user's active savings goals with progress percentage. Money fields as Rupiah integer strings.",
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  argsSchema: Args,
  async run(_args, { userId, prisma }) {
    const goals = await prisma.goal.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { created_at: 'asc' },
    });
    return {
      goals: goals.map((g) => {
        const target = g.target_amount;
        const saved = g.saved_amount;
        // progress_pct ∈ [0, 100] — bigint-safe integer math
        const pct =
          target === 0n ? 0 : Number(saved * 100n > target * 100n ? 100n : (saved * 100n) / target);
        return {
          id: g.id,
          name: g.name,
          target: target.toString(),
          saved: saved.toString(),
          deadline: g.deadline ? g.deadline.toISOString() : null,
          progress_pct: pct,
        };
      }),
    };
  },
};
