import { z } from 'zod';

export const CategoryKindSchema = z.enum(['expense', 'income']);
export type CategoryKind = z.infer<typeof CategoryKindSchema>;

export const categoryKindLabel: Record<CategoryKind, string> = {
  expense: 'Pengeluaran',
  income: 'Pemasukan',
};
