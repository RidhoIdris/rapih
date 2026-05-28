import { apiRequest } from '@/lib/api';
import type {
  CreateTransactionBody,
  TransactionDto,
  TransactionListResponse,
  TransactionResponse,
  UpdateTransactionBody,
} from '@rapih/shared';

type ListData = TransactionListResponse['data'];
type OneData = TransactionResponse['data'];

export type ListTransactionsParams = {
  wallet_id?: string;
  kind?: 'expense' | 'income' | 'transfer';
  limit?: number;
};

export async function listTransactions(params?: ListTransactionsParams): Promise<TransactionDto[]> {
  const qs = new URLSearchParams();
  if (params?.wallet_id) qs.set('wallet_id', params.wallet_id);
  if (params?.kind) qs.set('kind', params.kind);
  if (params?.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  const data = await apiRequest<ListData>(`/transactions${query ? `?${query}` : ''}`);
  return data.transactions;
}

export async function getTransaction(id: string): Promise<TransactionDto> {
  const data = await apiRequest<OneData>(`/transactions/${id}`);
  return data.transaction;
}

export async function createTransaction(body: CreateTransactionBody): Promise<TransactionDto> {
  const data = await apiRequest<OneData>('/transactions', { method: 'POST', body });
  return data.transaction;
}

export async function updateTransaction(
  id: string,
  body: UpdateTransactionBody,
): Promise<TransactionDto> {
  const data = await apiRequest<OneData>(`/transactions/${id}`, { method: 'PATCH', body });
  return data.transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  await apiRequest<void>(`/transactions/${id}`, { method: 'DELETE' });
}
