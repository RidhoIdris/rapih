import { Prisma } from '@rapih/db';
import type { Job } from 'bullmq';
import { loadEnv } from '../config/env.js';
import { computeCost } from '../lib/cost.js';
import { logger } from '../lib/logger.js';
import { getOpenAi } from '../lib/openai.js';
import { getPrisma } from '../lib/prisma.js';
import { getRedis } from '../lib/redis.js';
import { TOOL_SCHEMAS, TOOLS } from '../tools/index.js';
import { SYSTEM_PROMPT } from './system-prompt.js';

export type TanyaChatPayload = {
  user_id: string;
  session_id: string;
  user_message_id: string;
  job_id: string;
};

type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | {
      role: 'assistant';
      content: string;
      tool_calls: {
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }[];
    }
  | { role: 'tool'; tool_call_id: string; content: string };

type CollectedToolCall = {
  id: string;
  name: string;
  argumentsRaw: string;
  parsedArgs: unknown;
  result: unknown;
};

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function deriveTitle(firstUserText: string): string {
  const collapsed = firstUserText.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, 40).trimEnd();
}

export async function handleTanyaChat(job: Job<TanyaChatPayload>): Promise<void> {
  const env = loadEnv();
  const prisma = getPrisma();
  const redis = getRedis();
  const openai = getOpenAi();
  const { user_id, session_id, job_id, user_message_id } = job.data;
  const channel = `tanya:${job_id}`;

  try {
    // Load history (user + assistant only — exclude tool rows from the prompt
    // context; tool rows are kept in DB for transcript reconstruction).
    const recent = await prisma.aiMessage.findMany({
      where: { session_id, role: { in: ['user', 'assistant'] } },
      orderBy: { created_at: 'desc' },
      take: env.MAX_CONTEXT_MESSAGES,
    });
    const history = recent.reverse();

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    let assistantText = '';
    const toolCallsForRow: CollectedToolCall[] = [];
    let promptTokens = 0;
    let completionTokens = 0;
    let loopLimitHit = false;

    for (let i = 0; i < env.MAX_ITERATIONS; i++) {
      const stream = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: messages as never,
        tools: TOOL_SCHEMAS as never,
        stream: true,
        stream_options: { include_usage: true },
      });

      let textThisRound = '';
      let pendingToolCall: { id: string; name: string; argumentsRaw: string } | null = null;

      for await (const chunk of stream as AsyncIterable<{
        choices?: {
          delta?: {
            content?: string;
            tool_calls?: {
              index?: number;
              id?: string;
              type?: string;
              function?: { name?: string; arguments?: string };
            }[];
          };
          finish_reason?: string;
        }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      }>) {
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          textThisRound += delta.content;
          await redis.publish(channel, JSON.stringify({ type: 'token', text: delta.content }));
        }
        const tc = delta?.tool_calls?.[0];
        if (tc) {
          if (!pendingToolCall) {
            pendingToolCall = {
              id: tc.id ?? '',
              name: tc.function?.name ?? '',
              argumentsRaw: '',
            };
          }
          if (tc.id) pendingToolCall.id = tc.id;
          if (tc.function?.name) pendingToolCall.name = tc.function.name;
          if (tc.function?.arguments) pendingToolCall.argumentsRaw += tc.function.arguments;
        }
        if (chunk.usage) {
          if (typeof chunk.usage.prompt_tokens === 'number')
            promptTokens = chunk.usage.prompt_tokens;
          if (typeof chunk.usage.completion_tokens === 'number')
            completionTokens = chunk.usage.completion_tokens;
        }
      }

      assistantText += textThisRound;

      if (!pendingToolCall) break; // model finished

      const tool = TOOLS[pendingToolCall.name];
      const rawParsed = safeJsonParse(pendingToolCall.argumentsRaw);
      await redis.publish(
        channel,
        JSON.stringify({
          type: 'tool_call',
          name: pendingToolCall.name,
          args: rawParsed,
        })
      );

      let toolResult: unknown;
      let parsedArgs: unknown = rawParsed;
      if (!tool) {
        toolResult = { error: 'unknown_tool', name: pendingToolCall.name };
      } else {
        const argsCheck = tool.argsSchema.safeParse(rawParsed ?? {});
        if (!argsCheck.success) {
          toolResult = { error: 'invalid_args', detail: argsCheck.error.format() };
        } else {
          parsedArgs = argsCheck.data;
          try {
            toolResult = await tool.run(argsCheck.data, { userId: user_id, prisma });
          } catch (err) {
            logger.error({ err, tool: pendingToolCall.name }, 'tool run threw');
            toolResult = { error: 'tool_failed', message: 'Tool gagal dijalankan.' };
          }
        }
      }

      toolCallsForRow.push({
        id: pendingToolCall.id,
        name: pendingToolCall.name,
        argumentsRaw: pendingToolCall.argumentsRaw,
        parsedArgs,
        result: toolResult,
      });
      await redis.publish(
        channel,
        JSON.stringify({ type: 'tool_result', name: pendingToolCall.name })
      );

      // Append assistant tool_call + tool result to the rolling messages array.
      messages.push({
        role: 'assistant',
        content: textThisRound,
        tool_calls: [
          {
            id: pendingToolCall.id,
            type: 'function',
            function: {
              name: pendingToolCall.name,
              arguments: pendingToolCall.argumentsRaw,
            },
          },
        ],
      });
      messages.push({
        role: 'tool',
        tool_call_id: pendingToolCall.id,
        content: JSON.stringify(toolResult ?? {}),
      });

      if (i === env.MAX_ITERATIONS - 1) {
        loopLimitHit = true;
      }
    }

    // Persist assistant + tool rows, auto-title, and AiUsageLog
    const writes: Prisma.PrismaPromise<unknown>[] = [];

    const assistantRowCreate = prisma.aiMessage.create({
      data: { session_id, role: 'assistant', content: assistantText },
    });
    writes.push(assistantRowCreate);

    for (const tc of toolCallsForRow) {
      writes.push(
        prisma.aiMessage.create({
          data: {
            session_id,
            role: 'tool',
            content: '',
            tool_name: tc.name,
            tool_args: (tc.parsedArgs ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            tool_result: (tc.result ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          },
        })
      );
    }

    // Auto-title: derive from the triggering user message if session.title is empty.
    const session = await prisma.aiSession.findUnique({ where: { id: session_id } });
    let newTitle: string | undefined;
    if (session && session.title === '') {
      const userMsg = await prisma.aiMessage.findUnique({ where: { id: user_message_id } });
      if (userMsg?.content) {
        newTitle = deriveTitle(userMsg.content);
      }
    }

    writes.push(
      prisma.aiSession.update({
        where: { id: session_id },
        data: {
          last_message_at: new Date(),
          ...(newTitle ? { title: newTitle } : {}),
        },
      })
    );

    writes.push(
      prisma.aiUsageLog.create({
        data: {
          user_id,
          session_id,
          kind: 'chat',
          model: env.OPENAI_MODEL,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
          cost_usd: computeCost(env.OPENAI_MODEL, promptTokens, completionTokens),
        },
      })
    );

    const [assistantRow] = (await prisma.$transaction(writes)) as [{ id: string }, ...unknown[]];

    if (loopLimitHit) {
      await redis.publish(
        channel,
        JSON.stringify({
          type: 'error',
          code: 'tool_loop_limit',
          message: 'Permintaan terlalu kompleks, coba sederhanakan.',
        })
      );
      throw new Error('tool_loop_limit');
    }

    await redis.publish(channel, JSON.stringify({ type: 'done', message_id: assistantRow.id }));
  } catch (err) {
    logger.error({ err, job_id }, 'tanya-chat failed');
    await redis.publish(
      channel,
      JSON.stringify({
        type: 'error',
        code: 'internal',
        message: 'Maaf, terjadi kesalahan.',
      })
    );
    throw err;
  }
}
