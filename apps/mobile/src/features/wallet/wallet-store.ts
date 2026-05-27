import type { CreateWalletBody, UpdateWalletBody, WalletDto } from '@rapih/shared';
import { create } from 'zustand';
import {
    createWallet as apiCreate,
    deleteWallet as apiDelete,
    listWallets as apiList,
    updateWallet as apiUpdate,
} from './api';

type WalletState = {
  /** Loading state for the initial list fetch. */
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  wallets: WalletDto[];

  fetch: () => Promise<void>;
  create: (body: CreateWalletBody) => Promise<WalletDto>;
  update: (id: string, body: UpdateWalletBody) => Promise<WalletDto>;
  remove: (id: string) => Promise<void>;
};

export const useWalletStore = create<WalletState>((set, get) => ({
  status: 'idle',
  error: null,
  wallets: [],

  fetch: async () => {
    set({ status: 'loading', error: null });
    try {
      const wallets = await apiList();
      set({ status: 'ready', wallets });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat dompet.';
      set({ status: 'error', error: message });
    }
  },

  create: async (body) => {
    const wallet = await apiCreate(body);
    set({ wallets: [...get().wallets, wallet], status: 'ready' });
    return wallet;
  },

  update: async (id, body) => {
    const updated = await apiUpdate(id, body);
    set({
      wallets: get().wallets.map((w) => (w.id === id ? updated : w)),
    });
    return updated;
  },

  remove: async (id) => {
    await apiDelete(id);
    set({ wallets: get().wallets.filter((w) => w.id !== id) });
  },
}));
