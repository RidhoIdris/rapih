import type { CreateRecurringBody, RecurringDto, UpdateRecurringBody } from '@rapih/shared';
import { create } from 'zustand';
import {
  createRecurring as apiCreate,
  deleteRecurring as apiDelete,
  listRecurring as apiList,
  payRecurring as apiPay,
  updateRecurring as apiUpdate,
} from './api';

type RecurringState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  recurring: RecurringDto[];

  fetch: () => Promise<void>;
  create: (body: CreateRecurringBody) => Promise<RecurringDto>;
  update: (id: string, body: UpdateRecurringBody) => Promise<RecurringDto>;
  pay: (id: string) => Promise<RecurringDto>;
  remove: (id: string) => Promise<void>;
};

export const useRecurringStore = create<RecurringState>((set, get) => ({
  status: 'idle',
  error: null,
  recurring: [],

  fetch: async () => {
    set({ status: 'loading', error: null });
    try {
      const recurring = await apiList();
      set({ status: 'ready', recurring });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat tagihan rutin.';
      set({ status: 'error', error: message });
    }
  },

  create: async (body) => {
    const item = await apiCreate(body);
    set({ recurring: [...get().recurring, item], status: 'ready' });
    return item;
  },

  update: async (id, body) => {
    const updated = await apiUpdate(id, body);
    set({
      recurring: get().recurring.map((r) => (r.id === id ? updated : r)),
    });
    return updated;
  },

  pay: async (id) => {
    const updated = await apiPay(id);
    set({
      recurring: get().recurring.map((r) => (r.id === id ? updated : r)),
    });
    return updated;
  },

  remove: async (id) => {
    await apiDelete(id);
    set({ recurring: get().recurring.filter((r) => r.id !== id) });
  },
}));
