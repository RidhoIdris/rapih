import type { HomeSummary } from '@rapih/shared';
import { create } from 'zustand';
import { getHome } from './api';

type HomeState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  home: HomeSummary | null;
  fetch: () => Promise<void>;
};

export const useHomeStore = create<HomeState>((set) => ({
  status: 'idle',
  error: null,
  home: null,

  fetch: async () => {
    set({ status: 'loading', error: null });
    try {
      const home = await getHome();
      set({ status: 'ready', home });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat beranda.';
      set({ status: 'error', error: message });
    }
  },
}));
