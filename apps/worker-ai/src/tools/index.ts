import { getBudgetsTool } from './get-budgets.js';
import { getGoalsTool } from './get-goals.js';
import { getWalletsTool } from './get-wallets.js';
import { listTransactionsTool } from './list-transactions.js';
import { summarizeMonthTool } from './summarize-month.js';
import type { ToolDef } from './types.js';

export const TOOLS: Record<string, ToolDef> = {
  list_transactions: listTransactionsTool as ToolDef,
  summarize_month: summarizeMonthTool as ToolDef,
  get_budgets: getBudgetsTool as ToolDef,
  get_goals: getGoalsTool as ToolDef,
  get_wallets: getWalletsTool as ToolDef,
};

export const TOOL_SCHEMAS = Object.values(TOOLS).map((t) => ({
  type: 'function' as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  },
}));

export type { ToolContext, ToolDef } from './types.js';
