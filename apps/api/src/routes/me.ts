import { MeResponse, OnboardingBody } from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { userToDto } from '../lib/dto.js';
import { ok } from '../lib/envelope.js';

export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.patch(
    '/me/onboarding',
    {
      schema: {
        tags: ['me'],
        summary: 'Set onboarding fields and mark onboarding complete',
        body: OnboardingBody,
        response: { 200: MeResponse },
      },
      onRequest: [app.authenticate],
    },
    async (req) => {
      const userId = req.user.id;
      const updated = await app.db.$transaction(async (tx) => {
        await tx.userProfile.upsert({
          where: { user_id: userId },
          create: {
            user_id: userId,
            nickname: req.body.nickname,
            income_range: req.body.income_range,
            primary_goal: req.body.primary_goal,
          },
          update: {
            nickname: req.body.nickname,
            income_range: req.body.income_range,
            primary_goal: req.body.primary_goal,
          },
        });
        // Stamp only on first completion. Subsequent PATCHes don't bump it.
        const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (!current.onboarding_completed_at) {
          await tx.user.update({
            where: { id: userId },
            data: { onboarding_completed_at: new Date() },
          });
        }
        return tx.user.findUniqueOrThrow({
          where: { id: userId },
          include: { profile: true },
        });
      });
      return ok({ user: userToDto(updated) });
    }
  );
};
