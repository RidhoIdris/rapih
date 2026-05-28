import { z } from 'zod';
import { CategoryKindSchema } from './enums.js';

// ─── Request bodies ───────────────────────────────────────────────────────

export const CreateCategoryBody = z.object({
  kind: CategoryKindSchema,
  name: z.string().trim().min(1).max(60),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'must be a 6-digit hex color'),
  icon: z.string().trim().min(1).max(60),
});
export type CreateCategoryBody = z.infer<typeof CreateCategoryBody>;

export const UpdateCategoryBody = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'must be a 6-digit hex color')
      .optional(),
    icon: z.string().trim().min(1).max(60).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'at least one field required' });
export type UpdateCategoryBody = z.infer<typeof UpdateCategoryBody>;

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const CategoryDto = z.object({
  id: z.string(),
  is_system: z.boolean(),
  kind: CategoryKindSchema,
  name: z.string(),
  color: z.string(),
  icon: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CategoryDto = z.infer<typeof CategoryDto>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const CategoryResponse = z.object({
  ok: z.literal(true),
  data: z.object({ category: CategoryDto }),
});
export type CategoryResponse = z.infer<typeof CategoryResponse>;

export const CategoryListResponse = z.object({
  ok: z.literal(true),
  data: z.object({ categories: z.array(CategoryDto) }),
});
export type CategoryListResponse = z.infer<typeof CategoryListResponse>;
