import { randomUUID } from 'node:crypto';
import type { AiMessage, AiSession } from '@rapih/db';
import {
  type AiMessageDto,
  type AiSessionDto,
  CreateSessionBody,
  CreateSessionResponse,
  ListMessagesResponse,
  ListSessionsResponse,
  SendMessageBody,
  SendMessageResponse,
} from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';
import { getAiQueue } from '../producers/ai-queue.js';

const Params = z.object({ id: z.string().min(1) });

function sessionToDto(row: AiSession): AiSessionDto {
  return {
    id: row.id,
    title: row.title,
    created_at: row.created_at.toISOString(),
    last_message_at: row.last_message_at.toISOString(),
  };
}

function messageToDto(row: AiMessage): AiMessageDto {
  return {
    id: row.id,
    session_id: row.session_id,
    role: row.role,
    content: row.content,
    tool_name: row.tool_name,
    tool_args: (row.tool_args ?? null) as unknown,
    tool_result: (row.tool_result ?? null) as unknown,
    created_at: row.created_at.toISOString(),
  };
}

export const tanyaRoutes: FastifyPluginAsyncZod = async (app) => {
  // ─── List sessions ────────────────────────────────────────────────────
  app.get(
    '/tanya/sessions',
    {
      schema: {
        tags: ['tanya'],
        summary: "List the current user's Tanya chat sessions",
        response: { 200: ListSessionsResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding, app.requirePlus],
    },
    async (req) => {
      const rows = await app.db.aiSession.findMany({
        where: { user_id: req.user.id, deleted_at: null },
        orderBy: { last_message_at: 'desc' },
      });
      return ok({ sessions: rows.map(sessionToDto) });
    }
  );

  // ─── Create session ───────────────────────────────────────────────────
  app.post(
    '/tanya/sessions',
    {
      schema: {
        tags: ['tanya'],
        summary: 'Create a new Tanya chat session',
        body: CreateSessionBody,
        response: { 200: CreateSessionResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding, app.requirePlus],
    },
    async (req) => {
      const row = await app.db.aiSession.create({
        data: {
          user_id: req.user.id,
          title: req.body.title ?? '',
        },
      });
      return ok({ session: sessionToDto(row) });
    }
  );

  // ─── Delete session (soft) ────────────────────────────────────────────
  app.delete(
    '/tanya/sessions/:id',
    {
      schema: {
        tags: ['tanya'],
        summary: 'Soft-delete a Tanya chat session',
        params: Params,
      },
      onRequest: [app.authenticate, app.requireOnboarding, app.requirePlus],
    },
    async (req, reply) => {
      const result = await app.db.aiSession.updateMany({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
        data: { deleted_at: new Date() },
      });
      if (result.count === 0) {
        throw new AppError('tanya.session_not_found', 'Sesi Tanya tidak ditemukan.', 404);
      }
      reply.code(204).send();
    }
  );

  // ─── List messages in a session ───────────────────────────────────────
  app.get(
    '/tanya/sessions/:id/messages',
    {
      schema: {
        tags: ['tanya'],
        summary: 'List messages in a Tanya session (oldest first)',
        params: Params,
        response: { 200: ListMessagesResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding, app.requirePlus],
    },
    async (req) => {
      const session = await app.db.aiSession.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!session) {
        throw new AppError('tanya.session_not_found', 'Sesi Tanya tidak ditemukan.', 404);
      }
      const rows = await app.db.aiMessage.findMany({
        where: { session_id: session.id },
        orderBy: { created_at: 'asc' },
      });
      return ok({ messages: rows.map(messageToDto) });
    }
  );

  // ─── Send a message (enqueues completion job) ─────────────────────────
  app.post(
    '/tanya/sessions/:id/messages',
    {
      schema: {
        tags: ['tanya'],
        summary: 'Send a user message; enqueues an AI completion job',
        params: Params,
        body: SendMessageBody,
        response: { 200: SendMessageResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding, app.requirePlus],
    },
    async (req) => {
      const job_id = randomUUID();

      const userMessage = await app.db.$transaction(async (tx) => {
        const session = await tx.aiSession.findFirst({
          where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
        });
        if (!session) {
          throw new AppError('tanya.session_not_found', 'Sesi Tanya tidak ditemukan.', 404);
        }
        const msg = await tx.aiMessage.create({
          data: {
            session_id: session.id,
            role: 'user',
            content: req.body.text,
          },
        });
        await tx.aiSession.update({
          where: { id: session.id },
          data: { last_message_at: new Date() },
        });
        return msg;
      });

      await getAiQueue().add(
        'tanya.chat-completion',
        {
          user_id: req.user.id,
          session_id: req.params.id,
          user_message_id: userMessage.id,
          job_id,
        },
        {
          jobId: job_id,
          removeOnComplete: { age: 3600 },
          removeOnFail: { age: 86400 },
        }
      );

      return ok({ user_message: messageToDto(userMessage), job_id });
    }
  );
};
