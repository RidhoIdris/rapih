import { apiRequest } from '@/lib/api';
import type {
  CreateGoalBody,
  GoalDto,
  GoalListResponse,
  GoalResponse,
  UpdateGoalBody,
} from '@rapih/shared';

type ListData = GoalListResponse['data'];
type OneData = GoalResponse['data'];

export async function listGoals(): Promise<GoalDto[]> {
  const data = await apiRequest<ListData>('/goals');
  return data.goals;
}

export async function getGoal(id: string): Promise<GoalDto> {
  const data = await apiRequest<OneData>(`/goals/${id}`);
  return data.goal;
}

export async function createGoal(body: CreateGoalBody): Promise<GoalDto> {
  const data = await apiRequest<OneData>('/goals', { method: 'POST', body });
  return data.goal;
}

export async function updateGoal(id: string, body: UpdateGoalBody): Promise<GoalDto> {
  const data = await apiRequest<OneData>(`/goals/${id}`, { method: 'PATCH', body });
  return data.goal;
}

export async function deleteGoal(id: string): Promise<void> {
  await apiRequest<void>(`/goals/${id}`, { method: 'DELETE' });
}
