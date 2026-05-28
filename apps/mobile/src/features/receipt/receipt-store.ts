import type { ReceiptDto, UpdateReceiptBody } from '@rapih/shared';
import { create } from 'zustand';
import {
  createReceipt as apiCreate,
  deleteReceipt as apiDelete,
  listReceipts as apiList,
  updateReceipt as apiUpdate,
} from './api';

type CreateReceiptOpts = Parameters<typeof apiCreate>[0];

type ReceiptState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  receipts: ReceiptDto[];

  fetch: () => Promise<void>;
  create: (opts: CreateReceiptOpts) => Promise<ReceiptDto>;
  update: (id: string, body: UpdateReceiptBody) => Promise<ReceiptDto>;
  remove: (id: string) => Promise<void>;
};

export const useReceiptStore = create<ReceiptState>((set, get) => ({
  status: 'idle',
  error: null,
  receipts: [],

  fetch: async () => {
    set({ status: 'loading', error: null });
    try {
      const receipts = await apiList();
      set({ status: 'ready', receipts });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat struk.';
      set({ status: 'error', error: message });
    }
  },

  create: async (opts) => {
    const receipt = await apiCreate(opts);
    set({ receipts: [receipt, ...get().receipts], status: 'ready' });
    return receipt;
  },

  update: async (id, body) => {
    const updated = await apiUpdate(id, body);
    set({
      receipts: get().receipts.map((r) => (r.id === id ? updated : r)),
    });
    return updated;
  },

  remove: async (id) => {
    await apiDelete(id);
    set({ receipts: get().receipts.filter((r) => r.id !== id) });
  },
}));
