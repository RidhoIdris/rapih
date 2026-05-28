import { DeviceTokenResponse, RegisterDeviceBody } from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';

const ParamsToken = z.object({ token: z.string().min(1) });

function deviceToDto(row: {
  id: string;
  token: string;
  platform: string;
  label: string | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: row.id,
    token: row.token,
    platform: row.platform as 'ios' | 'android',
    label: row.label,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export const devicesRoutes: FastifyPluginAsyncZod = async (app) => {
  // ─── Register / upsert device token ───────────────────────────────────
  app.post(
    '/devices/register',
    {
      schema: {
        tags: ['devices'],
        summary: 'Register or update a push notification device token',
        body: RegisterDeviceBody,
        response: { 200: DeviceTokenResponse },
      },
      onRequest: [app.authenticate],
    },
    async (req) => {
      const { token, platform, label } = req.body;
      const device = await app.db.deviceToken.upsert({
        where: { token },
        update: { user_id: req.user.id, platform, label: label ?? null },
        create: { user_id: req.user.id, token, platform, label: label ?? null },
      });
      return ok({ device: deviceToDto(device) });
    }
  );

  // ─── Unregister device token ───────────────────────────────────────────
  app.delete(
    '/devices/:token',
    {
      schema: {
        tags: ['devices'],
        summary: 'Unregister a push notification device token',
        params: ParamsToken,
      },
      onRequest: [app.authenticate],
    },
    async (req, reply) => {
      const existing = await app.db.deviceToken.findFirst({
        where: { token: req.params.token, user_id: req.user.id },
      });
      if (!existing) {
        throw new AppError('device.not_found', 'Perangkat tidak ditemukan.', 404);
      }
      await app.db.deviceToken.delete({ where: { id: existing.id } });
      reply.code(204).send();
    }
  );
};
