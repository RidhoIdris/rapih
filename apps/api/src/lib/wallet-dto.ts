import type { Wallet } from '@rapih/db';
import type { WalletDto } from '@rapih/shared';

export function walletToDto(wallet: Wallet, computedBalance: bigint): WalletDto {
  return {
    id: wallet.id,
    kind: wallet.kind,
    provider_name: wallet.provider_name,
    label: wallet.label ?? null,
    initial_balance: wallet.initial_balance.toString(),
    balance: computedBalance.toString(),
    created_at: wallet.created_at.toISOString(),
    updated_at: wallet.updated_at.toISOString(),
  };
}
