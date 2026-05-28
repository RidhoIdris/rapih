import { apiRequest } from '@/lib/api';
import type {
    CreateWalletBody,
    UpdateWalletBody,
    WalletDto,
    WalletListResponse,
    WalletResponse,
} from '@rapih/shared';

type ListData = WalletListResponse['data'];
type OneData = WalletResponse['data'];

export async function listWallets(): Promise<WalletDto[]> {
  const data = await apiRequest<ListData>('/wallets');
  return data.wallets;
}

export async function getWallet(id: string): Promise<WalletDto> {
  const data = await apiRequest<OneData>(`/wallets/${id}`);
  return data.wallet;
}

export async function createWallet(body: CreateWalletBody): Promise<WalletDto> {
  const data = await apiRequest<OneData>('/wallets', { method: 'POST', body });
  return data.wallet;
}

export async function updateWallet(id: string, body: UpdateWalletBody): Promise<WalletDto> {
  const data = await apiRequest<OneData>(`/wallets/${id}`, { method: 'PATCH', body });
  return data.wallet;
}

export async function deleteWallet(id: string): Promise<void> {
  await apiRequest<void>(`/wallets/${id}`, { method: 'DELETE' });
}
