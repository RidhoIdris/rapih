import { z } from 'zod';

export const TransactionKindSchema = z.enum(['expense', 'income', 'transfer']);
export type TransactionKind = z.infer<typeof TransactionKindSchema>;

export const transactionKindLabel: Record<TransactionKind, string> = {
  expense: 'Pengeluaran',
  income: 'Pemasukan',
  transfer: 'Transfer',
};
