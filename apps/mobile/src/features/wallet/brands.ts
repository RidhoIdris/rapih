import type { WalletKind } from '@rapih/shared';

/**
 * Brand color and "default" label suggestions for wallet providers.
 * Display-only data — not stored on the backend.
 */
export type WalletProvider = {
  name: string;
  /** Subtitle shown in tambah-dompet provider list. */
  sub: string;
  /** Brand color for the avatar. */
  color: string;
};

export const PROVIDERS: Record<WalletKind, WalletProvider[]> = {
  bank: [
    { name: 'BCA', sub: 'Tahapan, Xpresi, Tabunganku', color: '#0060af' },
    { name: 'Mandiri', sub: 'Tabungan & Giro', color: '#003e7e' },
    { name: 'BNI', sub: 'Taplus, BNI Emerald', color: '#ee7300' },
    { name: 'BRI', sub: 'BritAma, Simpedes', color: '#003a78' },
    { name: 'CIMB', sub: 'OCTO Savers', color: '#7b2730' },
    { name: 'Permata', sub: 'PermataMe', color: '#4a8b3e' },
    { name: 'Jago', sub: 'Bank Jago', color: '#ff6b35' },
    { name: 'BSI', sub: 'BSI Tabungan', color: '#008951' },
  ],
  ewallet: [
    { name: 'GoPay', sub: 'Saldo & PayLater', color: '#00a2e0' },
    { name: 'OVO', sub: 'Saldo & Points', color: '#4a288e' },
    { name: 'ShopeePay', sub: 'Saldo & Coin', color: '#ee4d2d' },
    { name: 'DANA', sub: 'Saldo', color: '#118eea' },
    { name: 'LinkAja', sub: 'Saldo & Syariah', color: '#e6231f' },
  ],
  cash: [{ name: 'Tunai', sub: 'Manual', color: '#5a8a6a' }],
  investment: [
    { name: 'Bibit', sub: 'Reksadana', color: '#16c8b6' },
    { name: 'Ajaib', sub: 'Saham', color: '#a020f0' },
    { name: 'Pluang', sub: 'Multi-aset', color: '#3b82f6' },
    { name: 'Pintu', sub: 'Crypto', color: '#0066ff' },
  ],
  other: [{ name: 'Lainnya', sub: 'Custom', color: '#5a5a5a' }],
};

const FALLBACK_COLOR = '#5a8a6a';

/**
 * Look up brand color for a given (kind, provider_name). Falls back to a
 * neutral moss tone if the provider isn't in our curated list.
 */
export function brandColor(kind: WalletKind, providerName: string): string {
  const list = PROVIDERS[kind];
  const match = list.find((p) => p.name.toLowerCase() === providerName.toLowerCase());
  return match?.color ?? FALLBACK_COLOR;
}

export function brandInitials(providerName: string): string {
  return providerName.slice(0, 2).toUpperCase();
}
