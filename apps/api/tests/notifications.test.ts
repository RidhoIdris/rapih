import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

async function userWithToken(opts: { onboarded?: boolean } = { onboarded: true }) {
  const user = await prisma.user.create({
    data: {
      email: `notif-${Math.random().toString(36).slice(2)}@e.com`,
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

describe('notifications', () => {
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

  it('GET /notifications returns 401 without bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/notifications' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /notifications returns 403 if onboarding not complete', async () => {
    const { token } = await userWithToken({ onboarded: false });
    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  // ─── List ────────────────────────────────────────────────────────────

  it('GET /notifications returns empty list for new user', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.notifications).toEqual([]);
  });

  it('GET /notifications returns own notifications, newest first', async () => {
    const { token, user } = await userWithToken();
    await prisma.notification.create({
      data: {
        user_id: user.id,
        kind: 'recurring_due',
        title: 'old',
        body: 'old',
        created_at: new Date('2026-05-01'),
      },
    });
    await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 'new', body: 'new' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().data.notifications;
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('new');
  });

  it("GET /notifications excludes other users' rows", async () => {
    const other = await prisma.user.create({
      data: { email: 'other-notif@e.com', name: 'Other', onboarding_completed_at: new Date() },
    });
    await prisma.notification.create({
      data: { user_id: other.id, kind: 'streak_nudge', title: 'hidden', body: 'hidden' },
    });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.json().data.notifications).toEqual([]);
  });

  it('GET /notifications?unread=true filters by read state', async () => {
    const { token, user } = await userWithToken();
    await prisma.notification.create({
      data: {
        user_id: user.id,
        kind: 'streak_nudge',
        title: 'read',
        body: 'b',
        read_at: new Date(),
      },
    });
    await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 'unread', body: 'b' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/notifications?unread=true',
      headers: { authorization: `Bearer ${token}` },
    });
    const items = res.json().data.notifications;
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('unread');
  });

  it('GET /notifications?kind=goal_deadline filters by kind', async () => {
    const { token, user } = await userWithToken();
    await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 's', body: 's' },
    });
    await prisma.notification.create({
      data: { user_id: user.id, kind: 'goal_deadline', title: 'g', body: 'g' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/notifications?kind=goal_deadline',
      headers: { authorization: `Bearer ${token}` },
    });
    const items = res.json().data.notifications;
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('goal_deadline');
  });

  // ─── Mark read ───────────────────────────────────────────────────────

  it('POST /notifications/mark-read with ids marks listed', async () => {
    const { token, user } = await userWithToken();
    const r1 = await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 'a', body: 'a' },
    });
    const r2 = await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 'b', body: 'b' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/mark-read',
      headers: { authorization: `Bearer ${token}` },
      payload: { ids: [r1.id] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.updated).toBe(1);
    const r1Row = await prisma.notification.findUnique({ where: { id: r1.id } });
    const r2Row = await prisma.notification.findUnique({ where: { id: r2.id } });
    expect(r1Row?.read_at).not.toBeNull();
    expect(r2Row?.read_at).toBeNull();
  });

  it("POST /notifications/mark-read won't touch another user's notifications", async () => {
    const other = await prisma.user.create({
      data: { email: 'other-mr@e.com', name: 'Other', onboarding_completed_at: new Date() },
    });
    const r = await prisma.notification.create({
      data: { user_id: other.id, kind: 'streak_nudge', title: 'a', body: 'a' },
    });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/mark-read',
      headers: { authorization: `Bearer ${token}` },
      payload: { ids: [r.id] },
    });
    expect(res.json().data.updated).toBe(0);
    const row = await prisma.notification.findUnique({ where: { id: r.id } });
    expect(row?.read_at).toBeNull();
  });

  it('POST /notifications/mark-read with all marks every unread', async () => {
    const { token, user } = await userWithToken();
    await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 'a', body: 'a' },
    });
    await prisma.notification.create({
      data: { user_id: user.id, kind: 'streak_nudge', title: 'b', body: 'b' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/mark-read',
      headers: { authorization: `Bearer ${token}` },
      payload: { all: true },
    });
    expect(res.json().data.updated).toBe(2);
  });

  it('POST /notifications/mark-read returns 0 if already read', async () => {
    const { token, user } = await userWithToken();
    await prisma.notification.create({
      data: {
        user_id: user.id,
        kind: 'streak_nudge',
        title: 'a',
        body: 'a',
        read_at: new Date(),
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/mark-read',
      headers: { authorization: `Bearer ${token}` },
      payload: { all: true },
    });
    expect(res.json().data.updated).toBe(0);
  });
});
