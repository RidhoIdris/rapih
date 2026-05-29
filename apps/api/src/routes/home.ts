import { HomeResponse, transactionKindLabel } from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ok } from '../lib/envelope.js';

const DAY_MS = 86_400_000;
const BILL_WINDOW_DAYS = 14;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * GET /home — one aggregated payload for the Beranda dashboard, so the mobile
 * app makes a single call instead of fanning out to wallets/transactions/
 * budgets/goals/recurring. Names are resolved server-side.
 */
export const homeRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/home',
    {
      schema: {
        tags: ['home'],
        summary: 'Aggregated dashboard summary for Beranda',
        response: { 200: HomeResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const userId = req.user.id;
      const db = app.db;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysElapsed = now.getDate();
      const billHorizon = new Date(now.getTime() + BILL_WINDOW_DAYS * DAY_MS);

      const monthWhere = { gte: monthStart, lt: nextMonth };

      const [
        walletCount,
        txCount,
        initialAgg,
        incomeAllAgg,
        expenseAllAgg,
        monthExpenseAgg,
        monthIncomeAgg,
        lastMonthExpenseAgg,
        budgetAgg,
        goals,
        bills,
        monthExpenseRows,
        topCatGroups,
        recentRows,
      ] = await Promise.all([
        db.wallet.count({ where: { user_id: userId, deleted_at: null } }),
        db.transaction.count({ where: { user_id: userId, deleted_at: null } }),
        db.wallet.aggregate({
          where: { user_id: userId, deleted_at: null },
          _sum: { initial_balance: true },
        }),
        db.transaction.aggregate({
          where: { user_id: userId, deleted_at: null, kind: 'income' },
          _sum: { amount: true },
        }),
        db.transaction.aggregate({
          where: { user_id: userId, deleted_at: null, kind: 'expense' },
          _sum: { amount: true },
        }),
        db.transaction.aggregate({
          where: { user_id: userId, deleted_at: null, kind: 'expense', transacted_at: monthWhere },
          _sum: { amount: true },
        }),
        db.transaction.aggregate({
          where: { user_id: userId, deleted_at: null, kind: 'income', transacted_at: monthWhere },
          _sum: { amount: true },
        }),
        db.transaction.aggregate({
          where: {
            user_id: userId,
            deleted_at: null,
            kind: 'expense',
            transacted_at: { gte: lastMonthStart, lt: monthStart },
          },
          _sum: { amount: true },
        }),
        db.budget.aggregate({
          where: { user_id: userId, deleted_at: null },
          _sum: { amount: true },
        }),
        db.goal.findMany({
          where: { user_id: userId, deleted_at: null },
          select: { target_amount: true, saved_amount: true },
        }),
        db.recurringTransaction.findMany({
          where: {
            user_id: userId,
            deleted_at: null,
            kind: 'expense',
            next_due_date: { gte: now, lt: billHorizon },
          },
          orderBy: { next_due_date: 'asc' },
          select: { amount: true, icon: true, next_due_date: true },
        }),
        db.transaction.findMany({
          where: { user_id: userId, deleted_at: null, kind: 'expense', transacted_at: monthWhere },
          select: { amount: true, transacted_at: true },
        }),
        db.transaction.groupBy({
          by: ['category_id'],
          where: { user_id: userId, deleted_at: null, kind: 'expense', transacted_at: monthWhere },
          _sum: { amount: true },
        }),
        db.transaction.findMany({
          where: { user_id: userId, deleted_at: null },
          orderBy: [{ transacted_at: 'desc' }, { created_at: 'desc' }],
          take: 5,
          select: {
            id: true,
            kind: true,
            note: true,
            amount: true,
            transacted_at: true,
            category_id: true,
            wallet_id: true,
          },
        }),
      ]);

      // ── balances & month numbers ──────────────────────────────────────────
      const sumInitial = initialAgg._sum.initial_balance ?? 0n;
      const incomeAll = incomeAllAgg._sum.amount ?? 0n;
      const expenseAll = expenseAllAgg._sum.amount ?? 0n;
      // Transfers move between the user's own wallets → net zero across the set.
      const totalBalance = sumInitial + incomeAll - expenseAll;

      const monthExpense = Number(monthExpenseAgg._sum.amount ?? 0n);
      const monthIncome = Number(monthIncomeAgg._sum.amount ?? 0n);
      const lastMonthExpense = Number(lastMonthExpenseAgg._sum.amount ?? 0n);
      const net = monthIncome - monthExpense;
      const savingsRate = monthIncome > 0 ? clamp01(net / monthIncome) : 0;
      const avgPerDay = daysElapsed > 0 ? Math.round(monthExpense / daysElapsed) : 0;
      const projection = avgPerDay * daysInMonth;
      const deltaPct =
        lastMonthExpense > 0 ? (monthExpense - lastMonthExpense) / lastMonthExpense : null;

      // per-day expense buckets
      const daily = new Array<number>(daysInMonth).fill(0);
      for (const row of monthExpenseRows) {
        const d = new Date(row.transacted_at).getDate() - 1;
        if (d >= 0 && d < daysInMonth) daily[d] = (daily[d] ?? 0) + Number(row.amount);
      }

      // ── top categories ────────────────────────────────────────────────────
      const catIds = topCatGroups.map((g) => g.category_id).filter((id): id is string => !!id);
      const cats = catIds.length
        ? await db.category.findMany({
            where: { id: { in: catIds } },
            select: { id: true, name: true, color: true },
          })
        : [];
      const catById = new Map(cats.map((c) => [c.id, c]));
      const topCategories = topCatGroups
        .map((g) => ({ id: g.category_id, amount: Number(g._sum.amount ?? 0n) }))
        .filter((g) => g.id && g.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4)
        .map((g) => {
          const c = g.id ? catById.get(g.id) : undefined;
          return {
            id: g.id ?? 'uncategorized',
            name: c?.name ?? 'Tanpa kategori',
            color: c?.color ?? '#C9C9C9',
            amount: String(g.amount),
            pct: monthExpense > 0 ? g.amount / monthExpense : 0,
          };
        });

      // ── bills (recurring expenses due within the window) ───────────────────
      const billsTotal = bills.reduce((s, b) => s + b.amount, 0n);
      const nextDueDays = bills[0]
        ? Math.max(
            0,
            Math.ceil((new Date(bills[0].next_due_date).getTime() - now.getTime()) / DAY_MS)
          )
        : null;

      // ── goals ─────────────────────────────────────────────────────────────
      const totalSaved = goals.reduce((s, g) => s + g.saved_amount, 0n);
      const goalProgresses = goals
        .map((g) =>
          g.target_amount > 0n ? clamp01(Number(g.saved_amount) / Number(g.target_amount)) : 0
        )
        .slice(0, 5);
      const activeGoals = goals.filter(
        (g) => g.target_amount > 0n && g.saved_amount < g.target_amount
      ).length;

      // ── recent transactions (resolve names) ─────────────────────────────────
      const recentCatIds = recentRows.map((r) => r.category_id).filter((id): id is string => !!id);
      const recentWalletIds = recentRows.map((r) => r.wallet_id);
      const [recentCats, recentWallets] = await Promise.all([
        recentCatIds.length
          ? db.category.findMany({
              where: { id: { in: recentCatIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
        recentWalletIds.length
          ? db.wallet.findMany({
              where: { id: { in: recentWalletIds } },
              select: { id: true, provider_name: true },
            })
          : Promise.resolve([]),
      ]);
      const recentCatById = new Map(recentCats.map((c) => [c.id, c.name]));
      const recentWalletById = new Map(recentWallets.map((w) => [w.id, w.provider_name]));
      const recentTransactions = recentRows.map((r) => {
        const categoryName = r.category_id ? (recentCatById.get(r.category_id) ?? null) : null;
        const title = r.note?.trim() || categoryName || transactionKindLabel[r.kind];
        return {
          id: r.id,
          title,
          kind: r.kind,
          category_name: categoryName,
          wallet_name: recentWalletById.get(r.wallet_id) ?? null,
          amount: r.amount.toString(),
          transacted_at: r.transacted_at.toISOString(),
        };
      });

      return ok({
        home: {
          wallet_count: walletCount,
          transaction_count: txCount,
          total_balance: totalBalance.toString(),
          month: {
            expense: String(monthExpense),
            income: String(monthIncome),
            net: String(net),
            savings_rate: savingsRate,
            days_elapsed: daysElapsed,
            days_in_month: daysInMonth,
            avg_per_day: String(avgPerDay),
            projection: String(projection),
            daily_expense: daily.map(String),
            last_month_expense: String(lastMonthExpense),
            delta_pct: deltaPct,
          },
          budget_cap: (budgetAgg._sum.amount ?? 0n).toString(),
          top_categories: topCategories,
          bills: {
            count: bills.length,
            total: billsTotal.toString(),
            next_due_days: nextDueDays,
            icons: bills.slice(0, 3).map((b) => b.icon),
          },
          goals: {
            active_count: activeGoals,
            total_saved: totalSaved.toString(),
            progresses: goalProgresses,
          },
          recent_transactions: recentTransactions,
        },
      });
    }
  );
};
