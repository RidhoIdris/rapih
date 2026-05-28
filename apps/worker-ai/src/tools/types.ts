import type { PrismaClient } from '@rapih/db';
import type { z } from 'zod';

export type ToolContext = { userId: string; prisma: PrismaClient };

export type ToolDef<TArgs = unknown> = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  argsSchema: z.ZodType<TArgs>;
  run: (args: TArgs, ctx: ToolContext) => Promise<unknown>;
};
