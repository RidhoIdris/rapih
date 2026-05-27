import type { User } from '@rapih/db';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { loadEnv } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { verifyAccessToken } from './tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: User;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireOnboarding: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authDecorators: FastifyPluginAsync = async (app: FastifyInstance) => {
  const env = loadEnv();

  const authenticate = async (req: FastifyRequest, _reply: FastifyReply) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('auth.unauthorized', 'Anda harus masuk dulu.', 401);
    }
    const token = header.slice('Bearer '.length).trim();
    let claims: ReturnType<typeof verifyAccessToken>;
    try {
      claims = verifyAccessToken(token, env.JWT_ACCESS_SECRET);
    } catch {
      throw new AppError('auth.unauthorized', 'Anda harus masuk dulu.', 401);
    }
    const user = await app.db.user.findUnique({ where: { id: claims.sub } });
    if (!user) {
      throw new AppError('auth.unauthorized', 'Anda harus masuk dulu.', 401);
    }
    req.user = user;
  };

  const requireOnboarding = async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!req.user?.onboarding_completed_at) {
      if (!req.user) {
        throw new AppError('auth.unauthorized', 'Anda harus masuk dulu.', 401);
      }
      throw new AppError('onboarding.required', 'Lengkapi onboarding dulu untuk lanjut.', 403);
    }
  };

  app.decorate('authenticate', authenticate);
  app.decorate('requireOnboarding', requireOnboarding);
};

export default fp(authDecorators, { name: 'auth-decorators', dependencies: ['db'] });
