import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';
import {
  flushTestRedis,
  getTestAiQueue,
  getTestRedis,
  teardownTestRedis,
} from './helpers/test-redis.js';

const prisma = getTestPrisma();

type Tier = 'free' | 'plus' | 'pro';

async function userWithToken(opts: { onboarded?: boolean; tier?: Tier } = {}) {
  const onboarded = opts.onboarded ?? true;
  const tier: Tier = opts.tier ?? 'plus';
  const user = await prisma.user.create({
    data: {
      email: `tanya-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      tier,
      onboarding_completed_at: onboarded ? new Date() : null,
      profile: { create: {} },
    },
  });
  const token = signAccessToken({
    userId: user.id,
    tier,
    secret: process.env.JWT_ACCESS_SECRET as string,
    ttlSeconds: 900,
  });
  return { user, token };
}

describe('tanya REST', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
  });
  afterAll(async () => {
    await app.close();
    await teardownTestRedis();
  });

  // ─── Guards ──────────────────────────────────────────────────────────

  it('GET /tanya/sessions returns 401 without bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/tanya/sessions' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /tanya/sessions returns 403 if onboarding not complete', async () => {
    const { token } = await userWithToken({ onboarded: false });
    const res = await app.inject({
      method: 'GET',
      url: '/tanya/sessions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('onboarding.required');
  });

  it('GET /tanya/sessions returns 403 for Free user (tier.upgrade_required)', async () => {
    const { token } = await userWithToken({ tier: 'free' });
    const res = await app.inject({
      method: 'GET',
      url: '/tanya/sessions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('tier.upgrade_required');
  });

  // ─── Sessions list / create ──────────────────────────────────────────

  it('GET /tanya/sessions returns empty list for new Plus user', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/tanya/sessions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.sessions).toEqual([]);
  });

  it('POST /tanya/sessions creates a session and it appears in list', async () => {
    const { token } = await userWithToken();
    const create = await app.inject({
      method: 'POST',
      url: '/tanya/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Hello' },
    });
    expect(create.statusCode).toBe(200);
    expect(create.json().data.session.title).toBe('Hello');

    const list = await app.inject({
      method: 'GET',
      url: '/tanya/sessions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json().data.sessions).toHaveLength(1);
  });

  it('GET /tanya/sessions orders by last_message_at desc', async () => {
    const { token, user } = await userWithToken();
    const older = await prisma.aiSession.create({
      data: {
        user_id: user.id,
        title: 'older',
        last_message_at: new Date('2026-05-01'),
      },
    });
    const newer = await prisma.aiSession.create({
      data: {
        user_id: user.id,
        title: 'newer',
        last_message_at: new Date('2026-05-20'),
      },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/tanya/sessions',
      headers: { authorization: `Bearer ${token}` },
    });
    const ids = res.json().data.sessions.map((s: { id: string }) => s.id);
    expect(ids).toEqual([newer.id, older.id]);
  });

  // ─── Session delete ──────────────────────────────────────────────────

  it('DELETE /tanya/sessions/:id soft-deletes and excludes from list', async () => {
    const { token, user } = await userWithToken();
    const s = await prisma.aiSession.create({
      data: { user_id: user.id, title: 's' },
    });
    const del = await app.inject({
      method: 'DELETE',
      url: `/tanya/sessions/${s.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);

    const after = await prisma.aiSession.findUnique({ where: { id: s.id } });
    expect(after?.deleted_at).not.toBeNull();

    const list = await app.inject({
      method: 'GET',
      url: '/tanya/sessions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json().data.sessions).toEqual([]);
  });

  it("DELETE /tanya/sessions/:id returns 404 for another user's session", async () => {
    const other = await prisma.user.create({
      data: {
        email: 'tanya-other@e.com',
        name: 'Other',
        tier: 'plus',
        onboarding_completed_at: new Date(),
      },
    });
    const s = await prisma.aiSession.create({ data: { user_id: other.id, title: 's' } });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'DELETE',
      url: `/tanya/sessions/${s.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('tanya.session_not_found');
  });

  // ─── Messages list ───────────────────────────────────────────────────

  it('GET /tanya/sessions/:id/messages returns messages oldest→newest, including tool rows', async () => {
    const { token, user } = await userWithToken();
    const s = await prisma.aiSession.create({ data: { user_id: user.id, title: '' } });
    await prisma.aiMessage.create({
      data: {
        session_id: s.id,
        role: 'user',
        content: 'Hi',
        created_at: new Date('2026-05-01T00:00:00Z'),
      },
    });
    await prisma.aiMessage.create({
      data: {
        session_id: s.id,
        role: 'tool',
        content: '',
        tool_name: 'list_transactions',
        tool_args: { limit: 10 },
        tool_result: { count: 0 },
        created_at: new Date('2026-05-01T00:00:01Z'),
      },
    });
    await prisma.aiMessage.create({
      data: {
        session_id: s.id,
        role: 'assistant',
        content: 'Halo!',
        created_at: new Date('2026-05-01T00:00:02Z'),
      },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/tanya/sessions/${s.id}/messages`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const msgs = res.json().data.messages;
    expect(msgs).toHaveLength(3);
    expect(msgs[0].role).toBe('user');
    expect(msgs[1].role).toBe('tool');
    expect(msgs[1].tool_name).toBe('list_transactions');
    expect(msgs[2].role).toBe('assistant');
  });

  it("GET /tanya/sessions/:id/messages returns 404 for another user's session", async () => {
    const other = await prisma.user.create({
      data: {
        email: 'tanya-other2@e.com',
        name: 'Other',
        tier: 'plus',
        onboarding_completed_at: new Date(),
      },
    });
    const s = await prisma.aiSession.create({ data: { user_id: other.id, title: '' } });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: `/tanya/sessions/${s.id}/messages`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  // ─── Send message ────────────────────────────────────────────────────

  it('POST /tanya/sessions/:id/messages persists user msg, bumps last_message_at, enqueues job', async () => {
    const { token, user } = await userWithToken();
    const s = await prisma.aiSession.create({
      data: {
        user_id: user.id,
        title: '',
        last_message_at: new Date('2026-05-01T00:00:00Z'),
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/tanya/sessions/${s.id}/messages`,
      headers: { authorization: `Bearer ${token}` },
      payload: { text: 'Berapa pengeluaran saya?' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.user_message.role).toBe('user');
    expect(body.user_message.content).toBe('Berapa pengeluaran saya?');
    expect(typeof body.job_id).toBe('string');

    // Session last_message_at advanced
    const after = await prisma.aiSession.findUnique({ where: { id: s.id } });
    expect(after?.last_message_at.toISOString()).not.toBe('2026-05-01T00:00:00.000Z');

    // Job enqueued in BullMQ
    const queue = getTestAiQueue();
    try {
      const job = await queue.getJob(body.job_id);
      expect(job).toBeTruthy();
      expect(job?.name).toBe('tanya.chat-completion');
      expect(job?.data.user_id).toBe(user.id);
      expect(job?.data.session_id).toBe(s.id);
      expect(job?.data.user_message_id).toBe(body.user_message.id);
    } finally {
      await queue.close();
    }
  });

  it("POST /tanya/sessions/:id/messages returns 404 for another user's session", async () => {
    const other = await prisma.user.create({
      data: {
        email: 'tanya-other3@e.com',
        name: 'Other',
        tier: 'plus',
        onboarding_completed_at: new Date(),
      },
    });
    const s = await prisma.aiSession.create({ data: { user_id: other.id, title: '' } });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: `/tanya/sessions/${s.id}/messages`,
      headers: { authorization: `Bearer ${token}` },
      payload: { text: 'hi' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /tanya/sessions/:id/messages returns 404 for deleted session', async () => {
    const { token, user } = await userWithToken();
    const s = await prisma.aiSession.create({
      data: { user_id: user.id, title: '', deleted_at: new Date() },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/tanya/sessions/${s.id}/messages`,
      headers: { authorization: `Bearer ${token}` },
      payload: { text: 'hi' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('Free user blocked on POST /tanya/sessions/:id/messages too', async () => {
    const { token } = await userWithToken({ tier: 'free' });
    const res = await app.inject({
      method: 'POST',
      url: '/tanya/sessions/whatever/messages',
      headers: { authorization: `Bearer ${token}` },
      payload: { text: 'hi' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('tier.upgrade_required');
  });

  // ─── SSE bridge ──────────────────────────────────────────────────────

  async function enqueueJob(user_id: string): Promise<string> {
    const queue = getTestAiQueue();
    const job_id = `test-${Math.random().toString(36).slice(2)}`;
    try {
      await queue.add(
        'tanya.chat-completion',
        { user_id, session_id: 'sess', user_message_id: 'msg', job_id },
        { jobId: job_id }
      );
    } finally {
      await queue.close();
    }
    return job_id;
  }

  it('GET /tanya/jobs/:job_id/stream returns 401 without bearer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tanya/jobs/anything/stream',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /tanya/jobs/:job_id/stream returns 403 for Free user', async () => {
    const { token } = await userWithToken({ tier: 'free' });
    const res = await app.inject({
      method: 'GET',
      url: '/tanya/jobs/anything/stream',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /tanya/jobs/:job_id/stream returns 404 for non-existent job', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/tanya/jobs/does-not-exist/stream',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('tanya.job_not_found');
  });

  it("GET /tanya/jobs/:job_id/stream returns 404 for another user's job", async () => {
    const other = await prisma.user.create({
      data: {
        email: 'tanya-sse-other@e.com',
        name: 'Other',
        tier: 'plus',
        onboarding_completed_at: new Date(),
      },
    });
    const job_id = await enqueueJob(other.id);
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: `/tanya/jobs/${job_id}/stream`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /tanya/jobs/:job_id/stream forwards pubsub events as SSE frames', async () => {
    const { token, user } = await userWithToken();
    const job_id = await enqueueJob(user.id);

    const responsePromise = app.inject({
      method: 'GET',
      url: `/tanya/jobs/${job_id}/stream`,
      headers: { authorization: `Bearer ${token}` },
    });

    // Give the handler a moment to subscribe to the redis channel.
    await new Promise((r) => setTimeout(r, 150));

    const pub = getTestRedis().duplicate();
    try {
      await pub.publish(`tanya:${job_id}`, JSON.stringify({ type: 'token', text: 'Halo!' }));
      await pub.publish(
        `tanya:${job_id}`,
        JSON.stringify({ type: 'done', message_id: 'final-id' })
      );
    } finally {
      await pub.quit();
    }

    const res = await responsePromise;
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.body).toContain('"type":"token"');
    expect(res.body).toContain('Halo!');
    expect(res.body).toContain('"type":"done"');
    expect(res.body).toContain('final-id');
  });
});
