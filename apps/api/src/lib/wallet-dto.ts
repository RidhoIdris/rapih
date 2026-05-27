import type { Wallet } from '@rapih/db';
import type { WalletDto } from '@rapih/shared';

/**
 * Convert a Prisma Wallet row to the wire DTO. Money is sent as numeric string
 * to preserve BigInt precision across JSON.
 *
 * `balance` will become `initial_balance + sum(transactions)` once the
 * transactions chunk lands. For now they're equal.
 */
export function walletToDto(wallet: Wallet): WalletDto {
  return {
    id: wallet.id,
    kind: wallet.kind,
    provider_name: wallet.provider_name,
    label: wallet.label ?? null,
    initial_balance: wallet.initial_balance.toString(),
    balance: wallet.initial_balance.toString(),
    created_at: wallet.created_at.toISOString(),
    updated_at: wallet.updated_at.toISOString(),
  };
}
