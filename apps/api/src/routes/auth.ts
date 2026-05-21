import {
  AppleSignInBody,
  AuthSessionResponse,
  GoogleSignInBody,
  LogoutBody,
  MeResponse,
  RefreshBody,
  RefreshResponse,
} from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { parseDeviceLabel } from '../auth/device.js';
import { isApplePrivateRelay, normalizeEmail } from '../auth/email.js';
import {
  createInitialRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../auth/refresh-token-store.js';
import { getJwksOverride } from '../auth/test-overrides.js';
import { signAccessToken } from '../auth/tokens.js';
import { upsertUserFromSocial } from '../auth/upsert-user.js';
import { verifyAppleIdToken, verifyGoogleIdToken } from '../auth/verify-id-token.js';
import { loadEnv } from '../config/env.js';
import { userToDto } from '../lib/dto.js';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';

function deriveAppleName(payload: {
  email: string;
  bodyName?: { firstName?: string; lastName?: string };
  isRelay: boolean;
}): string {
  const composed =
    `${payload.bodyName?.firstName ?? ''} ${payload.bodyName?.lastName ?? ''}`.trim();
  if (composed.length > 0) return composed;
  if (!payload.isRelay) {
    const local = payload.email.split('@')[0];
    if (local && local.length > 0) return local;
  }
  return 'Pengguna Rapih';
}

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const env = loadEnv();

  app.post(
    '/auth/google',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign in with Google ID token',
        body: GoogleSignInBody,
        response: { 200: AuthSessionResponse },
      },
    },
    async (req) => {
      const claims = await verifyGoogleIdToken(req.body.id_token, {
        audiences: env.GOOGLE_OAUTH_CLIENT_IDS,
        jwksUrl: getJwksOverride('google'),
      });
      const email = normalizeEmail(claims.email);

      const user = await upsertUserFromSocial(app.db, {
        provider: 'google',
        providerUserId: claims.sub,
        email,
        name: claims.name?.trim() || email.split('@')[0] || 'Pengguna Rapih',
        isApplePrivateRelay: false,
        emailVerifiedAt: new Date(),
      });

      const access = signAccessToken({
        userId: user.id,
        tier: user.tier,
        secret: env.JWT_ACCESS_SECRET,
        ttlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      });
      const { plain: refresh } = await createInitialRefreshToken(app.db, {
        userId: user.id,
        ttlSeconds: env.JWT_REFRESH_TTL_SECONDS,
        deviceLabel: parseDeviceLabel(req.headers['user-agent']),
      });

      return ok({ access_token: access, refresh_token: refresh, user: userToDto(user) });
    }
  );

  app.post(
    '/auth/apple',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign in with Apple ID token',
        body: AppleSignInBody,
        response: { 200: AuthSessionResponse },
      },
    },
    async (req) => {
      const claims = await verifyAppleIdToken(req.body.id_token, {
        audiences: env.APPLE_OAUTH_CLIENT_IDS,
        jwksUrl: getJwksOverride('apple'),
      });
      const email = normalizeEmail(claims.email);
      const isRelay = isApplePrivateRelay(email);
      const name = deriveAppleName({ email, bodyName: req.body.name, isRelay });

      const user = await upsertUserFromSocial(app.db, {
        provider: 'apple',
        providerUserId: claims.sub,
        email,
        name,
        isApplePrivateRelay: isRelay,
        emailVerifiedAt: new Date(),
      });

      const access = signAccessToken({
        userId: user.id,
        tier: user.tier,
        secret: env.JWT_ACCESS_SECRET,
        ttlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      });
      const { plain: refresh } = await createInitialRefreshToken(app.db, {
        userId: user.id,
        ttlSeconds: env.JWT_REFRESH_TTL_SECONDS,
        deviceLabel: parseDeviceLabel(req.headers['user-agent']),
      });

      return ok({ access_token: access, refresh_token: refresh, user: userToDto(user) });
    }
  );

  app.post(
    '/auth/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Rotate the refresh token and issue a new access token',
        body: RefreshBody,
        response: { 200: RefreshResponse },
      },
    },
    async (req) => {
      const result = await rotateRefreshToken(app.db, {
        plainToken: req.body.refresh_token,
        ttlSeconds: env.JWT_REFRESH_TTL_SECONDS,
        deviceLabel: parseDeviceLabel(req.headers['user-agent']),
      });

      switch (result.kind) {
        case 'not_found':
          throw new AppError('auth.invalid_token', 'Token tidak valid.', 401);
        case 'expired':
          throw new AppError(
            'auth.token_expired',
            'Sesi sudah kadaluarsa, silakan masuk kembali.',
            401
          );
        case 'reused':
          throw new AppError(
            'auth.token_reused',
            'Sesi tidak aman, silakan masuk kembali di semua perangkat.',
            401
          );
        case 'rotated': {
          const user = await app.db.user.findUniqueOrThrow({ where: { id: result.userId } });
          const access = signAccessToken({
            userId: user.id,
            tier: user.tier,
            secret: env.JWT_ACCESS_SECRET,
            ttlSeconds: env.JWT_ACCESS_TTL_SECONDS,
          });
          return ok({ access_token: access, refresh_token: result.plain });
        }
      }
    }
  );

  app.post(
    '/auth/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Revoke a refresh token (idempotent)',
        body: LogoutBody,
      },
    },
    async (req, reply) => {
      await revokeRefreshToken(app.db, req.body.refresh_token);
      reply.code(204).send();
    }
  );

  app.get(
    '/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'Get the current user',
        response: { 200: MeResponse },
      },
      onRequest: [app.authenticate],
    },
    async (req) => {
      const user = await app.db.user.findUniqueOrThrow({
        where: { id: req.user.id },
        include: { profile: true },
      });
      return ok({ user: userToDto(user) });
    }
  );
};
