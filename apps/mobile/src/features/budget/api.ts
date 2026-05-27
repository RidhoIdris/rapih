import { apiRequest } from '@/lib/api';
import type {
  BudgetDto,
  BudgetListResponse,
  BudgetResponse,
  CreateBudgetBody,
  UpdateBudgetBody,
} from '@rapih/shared';

type ListData = BudgetListResponse['data'];
type OneData = BudgetResponse['data'];

export async function listBudgets(): Promise<BudgetDto[]> {
  const data = await apiRequest<ListData>('/budgets');
  return data.budgets;
}

export async function getBudget(id: string): Promise<BudgetDto> {
  const data = await apiRequest<OneData>(`/budgets/${id}`);
  return data.budget;
}

export async function createBudget(body: CreateBudgetBody): Promise<BudgetDto> {
  const data = await apiRequest<OneData>('/budgets', { method: 'POST', body });
  return data.budget;
}

export async function updateBudget(id: string, body: UpdateBudgetBody): Promise<BudgetDto> {
  const data = await apiRequest<OneData>(`/budgets/${id}`, { method: 'PATCH', body });
  return data.budget;
}

export async function deleteBudget(id: string): Promise<void> {
  await apiRequest<void>(`/budgets/${id}`, { method: 'DELETE' });
}
