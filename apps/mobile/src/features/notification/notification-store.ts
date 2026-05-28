import type { NotificationDto } from '@rapih/shared';
import { create } from 'zustand';
import * as api from './api';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type State = {
  status: Status;
  error: string | null;
  items: NotificationDto[];
  fetch: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
};

export const useNotificationStore = create<State>((set, get) => ({
  status: 'idle',
  error: null,
  items: [],

  fetch: async () => {
    set({ status: 'loading', error: null });
    try {
      const items = await api.listNotifications({ limit: 100 });
      set({ status: 'ready', items });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'unknown' });
    }
  },

  markRead: async (ids) => {
    const now = new Date().toISOString();
    set({
      items: get().items.map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n)),
    });
    try {
      await api.markRead(ids);
    } catch {
      // Best-effort optimistic update; next fetch will reconcile.
    }
  },

  markAllRead: async () => {
    const now = new Date().toISOString();
    set({
      items: get().items.map((n) => (n.read_at ? n : { ...n, read_at: now })),
    });
    try {
      await api.markAllRead();
    } catch {
      // ignore — reconcile on next fetch
    }
  },
}));
