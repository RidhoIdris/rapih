import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import './helpers/test-env.js';
import type { Job } from 'bullmq';
import { handleTanyaChat, type TanyaChatPayload } from '../src/handlers/tanya-chat.js';
import { __setOpenAiForTests } from '../src/lib/openai.js';
import { buildOpenAiStreamMock, type ScriptedTurn } from './helpers/openai-mock.js';
import { closeTestDb, getTestPrisma, resetTestDb } from './helpers/test-db.js';
import { closeTestRedis, flushTestRedis, getTestRedis } from './helpers/test-redis.js';

const prisma = getTestPrisma();

async function seedUserAndSession() {
  const user = await prisma.user.create({
    data: {
      email: `chat-${Math.random()}@e.com`,
      name: 'u',
      tier: 'plus',
      onboarding_completed_at: new Date(),
    },
  });
  const session = await prisma.aiSession.create({
    data: { user_id: user.id, title: '' },
  });
  return { user, session };
}

async function seedUserMessage(session_id: string, content: string) {
  return prisma.aiMessage.create({
    data: { session_id, role: 'user', content },
  });
}

function buildJob(payload: TanyaChatPayload): Job<TanyaChatPayload> {
  return { data: payload } as unknown as Job<TanyaChatPayload>;
}

async function collectEvents(channel: string, fn: () => Promise<void>): Promise<unknown[]> {
  const events: unknown[] = [];
  const sub = getTestRedis().duplicate();
  await sub.subscribe(channel);
  sub.on('message', (_c, payload) => events.push(JSON.parse(payload)));
  try {
    await fn();
  } finally {
    await sub.unsubscribe();
    await sub.quit();
  }
  return events;
}

describe('tanya-chat handler', () => {
  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
  });
  afterAll(async () => {
    __setOpenAiForTests(undefined);
    await closeTestDb();
    await closeTestRedis();
  });

  // ─── Happy path (no tools) ───────────────────────────────────────────

  it('happy path: streams tokens, persists assistant row, logs usage, publishes done', async () => {
    const { user, session } = await seedUserAndSession();
    const userMsg = await seedUserMessage(session.id, 'Halo Tanya');
    const turn: ScriptedTurn = [
      { content: 'Halo' },
      { content: '!' },
      { usage: { prompt_tokens: 10, completion_tokens: 5 } },
      { finish: 'stop' },
    ];
    const { client } = buildOpenAiStreamMock([turn]);
    __setOpenAiForTests(client);

    const job_id = 'job-happy';
    const events = await collectEvents(`tanya:${job_id}`, async () => {
      await handleTanyaChat(
        buildJob({
          user_id: user.id,
          session_id: session.id,
          user_message_id: userMsg.id,
          job_id,
        })
      );
    });

    const assistantRow = await prisma.aiMessage.findFirst({
      where: { session_id: session.id, role: 'assistant' },
    });
    expect(assistantRow?.content).toBe('Halo!');
    const usage = await prisma.aiUsageLog.findFirst({ where: { user_id: user.id } });
    expect(usage?.kind).toBe('chat');
    expect(usage?.prompt_tokens).toBe(10);
    expect(usage?.completion_tokens).toBe(5);
    expect(usage?.total_tokens).toBe(15);

    const tokenEvents = events.filter((e) => (e as { type: string }).type === 'token');
    expect(tokenEvents).toHaveLength(2);
    const doneEvt = events.find((e) => (e as { type: string }).type === 'done') as {
      message_id: string;
    };
    expect(doneEvt).toBeTruthy();
    expect(doneEvt.message_id).toBe(assistantRow?.id);
  });

  // ─── Tool-use happy path ─────────────────────────────────────────────

  it('tool-use: runs list_transactions, persists tool row, second turn finishes', async () => {
    const { user, session } = await seedUserAndSession();
    const userMsg = await seedUserMessage(session.id, 'Tampilkan transaksi');
    const turn1: ScriptedTurn = [
      {
        toolCall: {
          id: 'call_1',
          name: 'list_transactions',
          argumentsJson: '{"limit": 5}',
        },
      },
      { usage: { prompt_tokens: 20, completion_tokens: 0 } },
      { finish: 'tool_calls' },
    ];
    const turn2: ScriptedTurn = [
      { content: 'Tidak ada transaksi.' },
      { usage: { prompt_tokens: 30, completion_tokens: 10 } },
      { finish: 'stop' },
    ];
    const { client } = buildOpenAiStreamMock([turn1, turn2]);
    __setOpenAiForTests(client);

    const job_id = 'job-tool';
    const events = await collectEvents(`tanya:${job_id}`, async () => {
      await handleTanyaChat(
        buildJob({
          user_id: user.id,
          session_id: session.id,
          user_message_id: userMsg.id,
          job_id,
        })
      );
    });

    const messages = await prisma.aiMessage.findMany({
      where: { session_id: session.id },
      orderBy: { created_at: 'asc' },
    });
    const toolRow = messages.find((m) => m.role === 'tool');
    expect(toolRow).toBeTruthy();
    expect(toolRow?.tool_name).toBe('list_transactions');
    expect(toolRow?.tool_args).toEqual({ limit: 5 });
    expect(toolRow?.tool_result).toEqual({ transactions: [] });

    const assistantRow = messages.find((m) => m.role === 'assistant');
    expect(assistantRow?.content).toBe('Tidak ada transaksi.');

    const types = events.map((e) => (e as { type: string }).type);
    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    expect(types).toContain('done');
  });

  // ─── MAX_ITERATIONS exceeded ─────────────────────────────────────────

  it('MAX_ITERATIONS hit: publishes tool_loop_limit error and throws', async () => {
    const { user, session } = await seedUserAndSession();
    const userMsg = await seedUserMessage(session.id, 'Loop');
    // 5 turns all emitting tool calls (= MAX_ITERATIONS)
    const looping: ScriptedTurn = [
      {
        toolCall: {
          id: 'call_x',
          name: 'list_transactions',
          argumentsJson: '{}',
        },
      },
      { usage: { prompt_tokens: 10, completion_tokens: 0 } },
      { finish: 'tool_calls' },
    ];
    const { client } = buildOpenAiStreamMock([looping, looping, looping, looping, looping]);
    __setOpenAiForTests(client);

    const job_id = 'job-loop';
    const events: unknown[] = [];
    const sub = getTestRedis().duplicate();
    await sub.subscribe(`tanya:${job_id}`);
    sub.on('message', (_c, payload) => events.push(JSON.parse(payload)));

    let threw = false;
    try {
      await handleTanyaChat(
        buildJob({
          user_id: user.id,
          session_id: session.id,
          user_message_id: userMsg.id,
          job_id,
        })
      );
    } catch (err) {
      threw = true;
      expect((err as Error).message).toBe('tool_loop_limit');
    }
    await sub.unsubscribe();
    await sub.quit();

    expect(threw).toBe(true);
    const errEvent = events.find((e) => (e as { type: string }).type === 'error') as {
      code: string;
    };
    expect(errEvent?.code).toBe('tool_loop_limit');
  });

  // ─── Invalid tool args ───────────────────────────────────────────────

  it('invalid tool args: tool_result stored with error, assistant row persists, done published', async () => {
    const { user, session } = await seedUserAndSession();
    const userMsg = await seedUserMessage(session.id, 'Bad args');
    const turn1: ScriptedTurn = [
      {
        toolCall: {
          id: 'call_bad',
          name: 'list_transactions',
          argumentsJson: '{"limit": "not-a-number"}',
        },
      },
      { usage: { prompt_tokens: 10, completion_tokens: 0 } },
      { finish: 'tool_calls' },
    ];
    const turn2: ScriptedTurn = [
      { content: 'Oke.' },
      { usage: { prompt_tokens: 20, completion_tokens: 2 } },
      { finish: 'stop' },
    ];
    const { client } = buildOpenAiStreamMock([turn1, turn2]);
    __setOpenAiForTests(client);

    const job_id = 'job-badargs';
    await collectEvents(`tanya:${job_id}`, async () => {
      await handleTanyaChat(
        buildJob({
          user_id: user.id,
          session_id: session.id,
          user_message_id: userMsg.id,
          job_id,
        })
      );
    });
    const toolRow = await prisma.aiMessage.findFirst({
      where: { session_id: session.id, role: 'tool' },
    });
    const result = toolRow?.tool_result as { error?: string } | null;
    expect(result?.error).toBe('invalid_args');
    const assistantRow = await prisma.aiMessage.findFirst({
      where: { session_id: session.id, role: 'assistant' },
    });
    expect(assistantRow?.content).toBe('Oke.');
  });

  // ─── History trimming ────────────────────────────────────────────────

  it('history trimming: prior 25 messages → only last 20 reach the model', async () => {
    const { user, session } = await seedUserAndSession();
    for (let i = 0; i < 25; i++) {
      await prisma.aiMessage.create({
        data: {
          session_id: session.id,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `msg-${i}`,
          created_at: new Date(Date.now() + i * 10),
        },
      });
    }
    const userMsg = await prisma.aiMessage.findFirst({
      where: { session_id: session.id },
      orderBy: { created_at: 'desc' },
    });
    const turn: ScriptedTurn = [
      { content: 'ok' },
      { usage: { prompt_tokens: 1, completion_tokens: 1 } },
      { finish: 'stop' },
    ];
    const { client, capturedArgs } = buildOpenAiStreamMock([turn]);
    __setOpenAiForTests(client);

    await collectEvents('tanya:job-trim', async () => {
      await handleTanyaChat(
        buildJob({
          user_id: user.id,
          session_id: session.id,
          user_message_id: userMsg?.id ?? 'x',
          job_id: 'job-trim',
        })
      );
    });

    const args = capturedArgs[0] as { messages: { role: string }[] };
    // 1 system + 20 history = 21
    expect(args.messages.length).toBe(21);
    expect(args.messages[0]?.role).toBe('system');
  });

  // ─── Auto-title ──────────────────────────────────────────────────────

  it('auto-title: empty session title is set from first user message', async () => {
    const { user, session } = await seedUserAndSession();
    const userMsg = await seedUserMessage(
      session.id,
      'Berapa total pengeluaran saya bulan ini ya?'
    );
    const turn: ScriptedTurn = [
      { content: 'ok' },
      { usage: { prompt_tokens: 1, completion_tokens: 1 } },
      { finish: 'stop' },
    ];
    const { client } = buildOpenAiStreamMock([turn]);
    __setOpenAiForTests(client);

    await collectEvents('tanya:job-title', async () => {
      await handleTanyaChat(
        buildJob({
          user_id: user.id,
          session_id: session.id,
          user_message_id: userMsg.id,
          job_id: 'job-title',
        })
      );
    });
    const updated = await prisma.aiSession.findUnique({ where: { id: session.id } });
    expect(updated?.title).toBe('Berapa total pengeluaran saya bulan ini');
  });

  it('auto-title: existing title is preserved', async () => {
    const user = await prisma.user.create({
      data: {
        email: `chat2-${Math.random()}@e.com`,
        name: 'u',
        tier: 'plus',
        onboarding_completed_at: new Date(),
      },
    });
    const session = await prisma.aiSession.create({
      data: { user_id: user.id, title: 'Existing Title' },
    });
    const userMsg = await seedUserMessage(session.id, 'baru');
    const turn: ScriptedTurn = [
      { content: 'ok' },
      { usage: { prompt_tokens: 1, completion_tokens: 1 } },
      { finish: 'stop' },
    ];
    const { client } = buildOpenAiStreamMock([turn]);
    __setOpenAiForTests(client);

    await collectEvents('tanya:job-existing', async () => {
      await handleTanyaChat(
        buildJob({
          user_id: user.id,
          session_id: session.id,
          user_message_id: userMsg.id,
          job_id: 'job-existing',
        })
      );
    });
    const updated = await prisma.aiSession.findUnique({ where: { id: session.id } });
    expect(updated?.title).toBe('Existing Title');
  });

  // ─── Tool rows excluded from prompt history ──────────────────────────

  it('tool rows are NOT included in the prompt sent to the model', async () => {
    const { user, session } = await seedUserAndSession();
    await prisma.aiMessage.create({
      data: { session_id: session.id, role: 'user', content: 'first' },
    });
    await prisma.aiMessage.create({
      data: {
        session_id: session.id,
        role: 'tool',
        content: '',
        tool_name: 'list_transactions',
        tool_args: {},
        tool_result: { transactions: [] },
      },
    });
    const lastUser = await prisma.aiMessage.create({
      data: { session_id: session.id, role: 'user', content: 'second' },
    });
    const turn: ScriptedTurn = [
      { content: 'ok' },
      { usage: { prompt_tokens: 1, completion_tokens: 1 } },
      { finish: 'stop' },
    ];
    const { client, capturedArgs } = buildOpenAiStreamMock([turn]);
    __setOpenAiForTests(client);

    await collectEvents('tanya:job-notool', async () => {
      await handleTanyaChat(
        buildJob({
          user_id: user.id,
          session_id: session.id,
          user_message_id: lastUser.id,
          job_id: 'job-notool',
        })
      );
    });

    const args = capturedArgs[0] as { messages: { role: string }[] };
    const roles = args.messages.map((m) => m.role);
    expect(roles).not.toContain('tool');
  });

  // ─── OpenAI client throws ────────────────────────────────────────────

  it('OpenAI client throws: error event published and handler re-throws', async () => {
    const { user, session } = await seedUserAndSession();
    const userMsg = await seedUserMessage(session.id, 'boom');
    const fake = {
      chat: {
        completions: {
          create: async () => {
            throw new Error('upstream down');
          },
        },
      },
    } as unknown as Parameters<typeof __setOpenAiForTests>[0];
    __setOpenAiForTests(fake);

    const job_id = 'job-boom';
    const events: unknown[] = [];
    const sub = getTestRedis().duplicate();
    await sub.subscribe(`tanya:${job_id}`);
    sub.on('message', (_c, payload) => events.push(JSON.parse(payload)));

    let threw = false;
    try {
      await handleTanyaChat(
        buildJob({
          user_id: user.id,
          session_id: session.id,
          user_message_id: userMsg.id,
          job_id,
        })
      );
    } catch {
      threw = true;
    }
    await sub.unsubscribe();
    await sub.quit();
    expect(threw).toBe(true);
    const errEvent = events.find((e) => (e as { type: string }).type === 'error') as {
      code: string;
    };
    expect(errEvent?.code).toBe('internal');
  });
});
