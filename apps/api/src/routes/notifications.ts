import {
  MarkReadBody,
  MarkReadResponse,
  NotificationKindSchema,
  NotificationListResponse,
} from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok } from '../lib/envelope.js';

const ListQuery = z.object({
  unread: z.coerce.boolean().optional(),
  kind: NotificationKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

function notificationToDto(row: {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: unknown;
  read_at: Date | null;
  created_at: Date;
}) {
  return {
    id: row.id,
    kind: row.kind as 'recurring_due' | 'goal_deadline' | 'streak_nudge' | 'weekly_review',
    title: row.title,
    body: row.body,
    data: (row.data ?? null) as unknown,
    read_at: row.read_at ? row.read_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
  };
}

export const notificationsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ─── List notifications ────────────────────────────────────────────────
  app.get(
    '/notifications',
    {
      schema: {
        tags: ['notifications'],
        summary: "List the current user's in-app notifications",
        querystring: ListQuery,
        response: { 200: NotificationListResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const { unread, kind, limit } = req.query;
      const rows = await app.db.notification.findMany({
        where: {
          user_id: req.user.id,
          ...(unread === true && { read_at: null }),
          ...(kind && { kind }),
        },
        orderBy: { created_at: 'desc' },
        take: limit,
      });
      return ok({ notifications: rows.map(notificationToDto) });
    }
  );

  // ─── Mark as read (bulk or all) ────────────────────────────────────────
  app.post(
    '/notifications/mark-read',
    {
      schema: {
        tags: ['notifications'],
        summary: 'Mark notifications as read (by ids, or all unread)',
        body: MarkReadBody,
        response: { 200: MarkReadResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const body = req.body;
      const now = new Date();
      const result =
        'all' in body
          ? await app.db.notification.updateMany({
              where: { user_id: req.user.id, read_at: null },
              data: { read_at: now },
            })
          : await app.db.notification.updateMany({
              where: { user_id: req.user.id, id: { in: body.ids }, read_at: null },
              data: { read_at: now },
            });
      return ok({ updated: result.count });
    }
  );
};
