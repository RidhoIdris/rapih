import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { SYSTEM_CATEGORY_COUNT } from './helpers/seed-categories.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

async function userWithToken(opts: { onboarded?: boolean } = { onboarded: true }) {
  const user = await prisma.user.create({
    data: {
      email: `cat-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      onboarding_completed_at: opts.onboarded ? new Date() : null,
      profile: { create: {} },
    },
  });
  const token = signAccessToken({
    userId: user.id,
    tier: 'free',
    secret: process.env.JWT_ACCESS_SECRET as string,
    ttlSeconds: 900,
  });
  return { user, token };
}

describe('categories CRUD', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await app.close();
  });

  // ─── Auth / onboarding guards ────────────────────────────────────────

  it('GET /categories returns 401 without bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/categories' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /categories returns 403 if onboarding not complete', async () => {
    const { token } = await userWithToken({ onboarded: false });
    const res = await app.inject({
      method: 'GET',
      url: '/categories',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('onboarding.required');
  });

  // ─── List ────────────────────────────────────────────────────────────

  it('GET /categories returns all system categories for a new user', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/categories',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const { categories } = res.json().data;
    expect(categories).toHaveLength(SYSTEM_CATEGORY_COUNT);
    expect(categories.every((c: { is_system: boolean }) => c.is_system)).toBe(true);
  });

  it('GET /categories returns system + user custom after create', async () => {
    const { token } = await userWithToken();
    await app.inject({
      method: 'POST',
      url: '/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { kind: 'expense', name: 'Hobi', color: '#AABBCC', icon: 'star' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/categories',
      headers: { authorization: `Bearer ${token}` },
    });
    const { categories } = res.json().data;
    expect(categories).toHaveLength(SYSTEM_CATEGORY_COUNT + 1);
    const custom = categories.filter((c: { is_system: boolean }) => !c.is_system);
    expect(custom).toHaveLength(1);
    expect(custom[0].name).toBe('Hobi');
  });

  it("GET /categories does not include another user's custom categories", async () => {
    const { token: tokenA } = await userWithToken();
    const { token: tokenB } = await userWithToken();
    await app.inject({
      method: 'POST',
      url: '/categories',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { kind: 'income', name: 'Freelance', color: '#112233', icon: 'code' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/categories',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    const { categories } = res.json().data;
    expect(categories).toHaveLength(SYSTEM_CATEGORY_COUNT);
    expect(categories.every((c: { is_system: boolean }) => c.is_system)).toBe(true);
  });

  // ─── Create ──────────────────────────────────────────────────────────

  it('POST /categories creates a custom category', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { kind: 'expense', name: 'Hobi', color: '#AABBCC', icon: 'star' },
    });
    expect(res.statusCode).toBe(200);
    const { category } = res.json().data;
    expect(category.name).toBe('Hobi');
    expect(category.kind).toBe('expense');
    expect(category.is_system).toBe(false);
  });

  it('POST /categories rejects invalid body', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { kind: 'bogus', name: '', color: 'not-a-hex', icon: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  // ─── Get single ──────────────────────────────────────────────────────

  it('GET /categories/:id returns a system category', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/categories/cat_sys_makan',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.category.is_system).toBe(true);
    expect(res.json().data.category.name).toBe('Makan & Minum');
  });

  it('GET /categories/:id returns the user own custom category', async () => {
    const { token, user } = await userWithToken();
    const cat = await prisma.category.create({
      data: { user_id: user.id, kind: 'income', name: 'Bonus', color: '#FFFFFF', icon: 'gift' },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/categories/${cat.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.category.id).toBe(cat.id);
    expect(res.json().data.category.is_system).toBe(false);
  });

  it("GET /categories/:id returns 404 for another user's custom category", async () => {
    const other = await prisma.user.create({
      data: { email: 'other-cat@e.com', name: 'Other', onboarding_completed_at: new Date() },
    });
    const otherCat = await prisma.category.create({
      data: { user_id: other.id, kind: 'expense', name: 'Secret', color: '#000000', icon: 'lock' },
    });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: `/categories/${otherCat.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('category.not_found');
  });

  // ─── Update ──────────────────────────────────────────────────────────

  it('PATCH /categories/:id updates a custom category', async () => {
    const { token, user } = await userWithToken();
    const cat = await prisma.category.create({
      data: { user_id: user.id, kind: 'expense', name: 'Old', color: '#111111', icon: 'x' },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/categories/${cat.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'New Name', color: '#ABCDEF' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.category.name).toBe('New Name');
    expect(res.json().data.category.color).toBe('#ABCDEF');
  });

  it('PATCH /categories/:id rejects empty body', async () => {
    const { token, user } = await userWithToken();
    const cat = await prisma.category.create({
      data: { user_id: user.id, kind: 'expense', name: 'Old', color: '#111111', icon: 'x' },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/categories/${cat.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  it('PATCH /categories/:id returns 404 for system category (cannot be updated)', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'PATCH',
      url: '/categories/cat_sys_makan',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Hacked' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('category.not_found');
  });

  // ─── Delete ──────────────────────────────────────────────────────────

  it('DELETE /categories/:id soft-deletes, list omits it', async () => {
    const { token, user } = await userWithToken();
    const cat = await prisma.category.create({
      data: {
        user_id: user.id,
        kind: 'expense',
        name: 'ToDelete',
        color: '#FFFFFF',
        icon: 'trash',
      },
    });
    const del = await app.inject({
      method: 'DELETE',
      url: `/categories/${cat.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);

    const dbRow = await prisma.category.findUnique({ where: { id: cat.id } });
    expect(dbRow?.deleted_at).not.toBeNull();

    const list = await app.inject({
      method: 'GET',
      url: '/categories',
      headers: { authorization: `Bearer ${token}` },
    });
    const custom = list.json().data.categories.filter((c: { is_system: boolean }) => !c.is_system);
    expect(custom).toHaveLength(0);
  });

  it('DELETE /categories/:id returns 404 if already deleted', async () => {
    const { token, user } = await userWithToken();
    const cat = await prisma.category.create({
      data: {
        user_id: user.id,
        kind: 'expense',
        name: 'Gone',
        color: '#FFFFFF',
        icon: 'trash',
        deleted_at: new Date(),
      },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/categories/${cat.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /categories/:id returns 404 for system category (cannot be deleted)', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'DELETE',
      url: '/categories/cat_sys_gaji',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('category.not_found');
  });
});
