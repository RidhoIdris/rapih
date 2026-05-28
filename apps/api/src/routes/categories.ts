import {
  CategoryListResponse,
  CategoryResponse,
  CreateCategoryBody,
  UpdateCategoryBody,
} from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { categoryToDto } from '../lib/category-dto.js';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';

const ParamsId = z.object({ id: z.string().min(1) });

export const categoriesRoutes: FastifyPluginAsyncZod = async (app) => {
  // ─── List categories ───────────────────────────────────────────────────
  // Returns system categories (user_id = null) + the current user's custom
  // categories. System first (by name), then user's in creation order.
  app.get(
    '/categories',
    {
      schema: {
        tags: ['categories'],
        summary: "List system categories and the current user's custom categories",
        response: { 200: CategoryListResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const [system, custom] = await Promise.all([
        app.db.category.findMany({
          where: { user_id: null },
          orderBy: [{ kind: 'asc' }, { name: 'asc' }],
        }),
        app.db.category.findMany({
          where: { user_id: req.user.id, deleted_at: null },
          orderBy: { created_at: 'asc' },
        }),
      ]);
      return ok({ categories: [...system, ...custom].map(categoryToDto) });
    }
  );

  // ─── Create custom category ────────────────────────────────────────────
  app.post(
    '/categories',
    {
      schema: {
        tags: ['categories'],
        summary: 'Create a custom category',
        body: CreateCategoryBody,
        response: { 200: CategoryResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const body = req.body;
      const category = await app.db.category.create({
        data: {
          user_id: req.user.id,
          kind: body.kind,
          name: body.name,
          color: body.color,
          icon: body.icon,
        },
      });
      return ok({ category: categoryToDto(category) });
    }
  );

  // ─── Get one category ──────────────────────────────────────────────────
  // Returns a system category (accessible to any user) or the user's own
  // custom category. Cross-user custom categories return 404.
  app.get(
    '/categories/:id',
    {
      schema: {
        tags: ['categories'],
        summary: 'Get a single category',
        params: ParamsId,
        response: { 200: CategoryResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const category = await app.db.category.findFirst({
        where: {
          id: req.params.id,
          deleted_at: null,
          OR: [{ user_id: null }, { user_id: req.user.id }],
        },
      });
      if (!category) {
        throw new AppError('category.not_found', 'Kategori tidak ditemukan.', 404);
      }
      return ok({ category: categoryToDto(category) });
    }
  );

  // ─── Update custom category ────────────────────────────────────────────
  // System categories cannot be updated — they return 404 to avoid leaking
  // that the ID exists.
  app.patch(
    '/categories/:id',
    {
      schema: {
        tags: ['categories'],
        summary: 'Update a custom category (name, color, or icon)',
        params: ParamsId,
        body: UpdateCategoryBody,
        response: { 200: CategoryResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const existing = await app.db.category.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('category.not_found', 'Kategori tidak ditemukan.', 404);
      }
      const body = req.body;
      const updated = await app.db.category.update({
        where: { id: existing.id },
        data: {
          name: body.name,
          color: body.color,
          icon: body.icon,
        },
      });
      return ok({ category: categoryToDto(updated) });
    }
  );

  // ─── Soft-delete custom category ──────────────────────────────────────
  // System categories cannot be deleted — they return 404.
  app.delete(
    '/categories/:id',
    {
      schema: {
        tags: ['categories'],
        summary: 'Soft-delete a custom category',
        params: ParamsId,
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req, reply) => {
      const existing = await app.db.category.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('category.not_found', 'Kategori tidak ditemukan.', 404);
      }
      await app.db.category.update({
        where: { id: existing.id },
        data: { deleted_at: new Date() },
      });
      reply.code(204).send();
    }
  );
};
