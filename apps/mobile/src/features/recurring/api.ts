import { apiRequest } from '@/lib/api';
import type {
  CreateRecurringBody,
  RecurringDto,
  RecurringListResponse,
  RecurringResponse,
  UpdateRecurringBody,
} from '@rapih/shared';

type ListData = RecurringListResponse['data'];
type OneData = RecurringResponse['data'];

export async function listRecurring(): Promise<RecurringDto[]> {
  const data = await apiRequest<ListData>('/recurring');
  return data.recurring;
}

export async function getRecurring(id: string): Promise<RecurringDto> {
  const data = await apiRequest<OneData>(`/recurring/${id}`);
  return data.recurring;
}

export async function createRecurring(body: CreateRecurringBody): Promise<RecurringDto> {
  const data = await apiRequest<OneData>('/recurring', { method: 'POST', body });
  return data.recurring;
}

export async function updateRecurring(id: string, body: UpdateRecurringBody): Promise<RecurringDto> {
  const data = await apiRequest<OneData>(`/recurring/${id}`, { method: 'PATCH', body });
  return data.recurring;
}

export async function deleteRecurring(id: string): Promise<void> {
  await apiRequest<void>(`/recurring/${id}`, { method: 'DELETE' });
}

export async function payRecurring(id: string): Promise<RecurringDto> {
  const data = await apiRequest<OneData>(`/recurring/${id}/pay`, { method: 'POST' });
  return data.recurring;
}
