import type { CreateGoalBody, GoalDto, UpdateGoalBody } from '@rapih/shared';
import { create } from 'zustand';
import {
  createGoal as apiCreate,
  deleteGoal as apiDelete,
  listGoals as apiList,
  updateGoal as apiUpdate,
} from './api';

type GoalState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  goals: GoalDto[];

  fetch: () => Promise<void>;
  create: (body: CreateGoalBody) => Promise<GoalDto>;
  update: (id: string, body: UpdateGoalBody) => Promise<GoalDto>;
  remove: (id: string) => Promise<void>;
};

export const useGoalStore = create<GoalState>((set, get) => ({
  status: 'idle',
  error: null,
  goals: [],

  fetch: async () => {
    set({ status: 'loading', error: null });
    try {
      const goals = await apiList();
      set({ status: 'ready', goals });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat tujuan.';
      set({ status: 'error', error: message });
    }
  },

  create: async (body) => {
    const goal = await apiCreate(body);
    set({ goals: [...get().goals, goal], status: 'ready' });
    return goal;
  },

  update: async (id, body) => {
    const updated = await apiUpdate(id, body);
    set({
      goals: get().goals.map((g) => (g.id === id ? updated : g)),
    });
    return updated;
  },

  remove: async (id) => {
    await apiDelete(id);
    set({ goals: get().goals.filter((g) => g.id !== id) });
  },
}));
