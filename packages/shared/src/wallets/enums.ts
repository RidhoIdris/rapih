import { z } from 'zod';

export const WalletKindSchema = z.enum(['bank', 'ewallet', 'cash', 'investment', 'other']);
export type WalletKind = z.infer<typeof WalletKindSchema>;

export const walletKindLabel: Record<WalletKind, string> = {
  bank: 'Bank',
  ewallet: 'E-wallet',
  cash: 'Tunai',
  investment: 'Investasi',
  other: 'Lainnya',
};
