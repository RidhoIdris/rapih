import type { BudgetDto, CreateBudgetBody, UpdateBudgetBody } from '@rapih/shared';
import { create } from 'zustand';
import {
  createBudget as apiCreate,
  deleteBudget as apiDelete,
  listBudgets as apiList,
  updateBudget as apiUpdate,
} from './api';

type BudgetState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  budgets: BudgetDto[];

  fetch: () => Promise<void>;
  create: (body: CreateBudgetBody) => Promise<BudgetDto>;
  update: (id: string, body: UpdateBudgetBody) => Promise<BudgetDto>;
  remove: (id: string) => Promise<void>;
};

export const useBudgetStore = create<BudgetState>((set, get) => ({
  status: 'idle',
  error: null,
  budgets: [],

  fetch: async () => {
    set({ status: 'loading', error: null });
    try {
      const budgets = await apiList();
      set({ status: 'ready', budgets });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat budget.';
      set({ status: 'error', error: message });
    }
  },

  create: async (body) => {
    const budget = await apiCreate(body);
    set({ budgets: [...get().budgets, budget], status: 'ready' });
    return budget;
  },

  update: async (id, body) => {
    const updated = await apiUpdate(id, body);
    set({
      budgets: get().budgets.map((b) => (b.id === id ? updated : b)),
    });
    return updated;
  },

  remove: async (id) => {
    await apiDelete(id);
    set({ budgets: get().budgets.filter((b) => b.id !== id) });
  },
}));
