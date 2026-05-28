import { Prisma } from '@rapih/db';

const PRICING: Record<string, { promptPer1k: number; completionPer1k: number }> = {
  'gpt-4o-mini': { promptPer1k: 0.00015, completionPer1k: 0.0006 },
  'gpt-4o': { promptPer1k: 0.0025, completionPer1k: 0.01 },
};

/**
 * Compute USD cost as a 6-decimal Prisma.Decimal. Returns 0 for unknown models
 * (logged as a warning by callers if needed).
 */
export function computeCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): Prisma.Decimal {
  const rate = PRICING[model];
  if (!rate) return new Prisma.Decimal(0);
  const cost =
    (promptTokens / 1000) * rate.promptPer1k + (completionTokens / 1000) * rate.completionPer1k;
  return new Prisma.Decimal(cost.toFixed(6));
}
