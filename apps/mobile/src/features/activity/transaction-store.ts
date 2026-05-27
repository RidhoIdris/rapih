import type { CreateTransactionBody, TransactionDto, UpdateTransactionBody } from '@rapih/shared';
import { create } from 'zustand';
import {
  createTransaction as apiCreate,
  deleteTransaction as apiDelete,
  listTransactions as apiList,
  updateTransaction as apiUpdate,
  type ListTransactionsParams,
} from './api';

type TransactionState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  items: TransactionDto[];

  fetch: (params?: ListTransactionsParams) => Promise<void>;
  create: (body: CreateTransactionBody) => Promise<TransactionDto>;
  update: (id: string, body: UpdateTransactionBody) => Promise<TransactionDto>;
  remove: (id: string) => Promise<void>;
};

export const useTransactionStore = create<TransactionState>((set, get) => ({
  status: 'idle',
  error: null,
  items: [],

  fetch: async (params) => {
    set({ status: 'loading', error: null });
    try {
      const items = await apiList(params);
      set({ status: 'ready', items });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat transaksi.';
      set({ status: 'error', error: message });
    }
  },

  create: async (body) => {
    const transaction = await apiCreate(body);
    set({ items: [transaction, ...get().items], status: 'ready' });
    return transaction;
  },

  update: async (id, body) => {
    const updated = await apiUpdate(id, body);
    set({ items: get().items.map((t) => (t.id === id ? updated : t)) });
    return updated;
  },

  remove: async (id) => {
    await apiDelete(id);
    set({ items: get().items.filter((t) => t.id !== id) });
  },
}));
