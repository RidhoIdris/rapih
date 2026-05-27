import { apiRequest } from '@/lib/api';
import type {
  CategoryDto,
  CategoryListResponse,
  CategoryResponse,
  CreateCategoryBody,
  UpdateCategoryBody,
} from '@rapih/shared';

type ListData = CategoryListResponse['data'];
type OneData = CategoryResponse['data'];

export async function listCategories(): Promise<CategoryDto[]> {
  const data = await apiRequest<ListData>('/categories');
  return data.categories;
}

export async function getCategory(id: string): Promise<CategoryDto> {
  const data = await apiRequest<OneData>(`/categories/${id}`);
  return data.category;
}

export async function createCategory(body: CreateCategoryBody): Promise<CategoryDto> {
  const data = await apiRequest<OneData>('/categories', { method: 'POST', body });
  return data.category;
}

export async function updateCategory(id: string, body: UpdateCategoryBody): Promise<CategoryDto> {
  const data = await apiRequest<OneData>(`/categories/${id}`, { method: 'PATCH', body });
  return data.category;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiRequest<void>(`/categories/${id}`, { method: 'DELETE' });
}
