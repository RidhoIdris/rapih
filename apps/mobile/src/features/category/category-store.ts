import type { CategoryDto, CategoryKind, CreateCategoryBody, UpdateCategoryBody } from '@rapih/shared';
import { create } from 'zustand';
import {
  createCategory as apiCreate,
  deleteCategory as apiDelete,
  listCategories as apiList,
  updateCategory as apiUpdate,
} from './api';

type CategoryState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  items: CategoryDto[];

  /** Convenience: all expense categories (system + custom) */
  expense: () => CategoryDto[];
  /** Convenience: all income categories (system + custom) */
  income: () => CategoryDto[];

  fetch: () => Promise<void>;
  create: (body: CreateCategoryBody) => Promise<CategoryDto>;
  update: (id: string, body: UpdateCategoryBody) => Promise<CategoryDto>;
  remove: (id: string) => Promise<void>;
};

function byKind(items: CategoryDto[], kind: CategoryKind): CategoryDto[] {
  return items.filter((c) => c.kind === kind);
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  status: 'idle',
  error: null,
  items: [],

  expense: () => byKind(get().items, 'expense'),
  income: () => byKind(get().items, 'income'),

  fetch: async () => {
    set({ status: 'loading', error: null });
    try {
      const items = await apiList();
      set({ status: 'ready', items });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat kategori.';
      set({ status: 'error', error: message });
    }
  },

  create: async (body) => {
    const category = await apiCreate(body);
    set({ items: [...get().items, category], status: 'ready' });
    return category;
  },

  update: async (id, body) => {
    const updated = await apiUpdate(id, body);
    set({ items: get().items.map((c) => (c.id === id ? updated : c)) });
    return updated;
  },

  remove: async (id) => {
    await apiDelete(id);
    set({ items: get().items.filter((c) => c.id !== id) });
  },
}));
