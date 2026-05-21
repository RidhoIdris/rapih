import type { FastifyInstance } from 'fastify';
import { err } from './envelope.js';

export class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, httpStatus = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

type Options = { nodeEnv: 'development' | 'test' | 'production' };

export function registerErrorHandler(app: FastifyInstance, opts: Options): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.httpStatus).send(err(error.code, error.message, error.details));
      return;
    }

    // Fastify schema validation (JSON Schema or zod via type provider).
    if ((error as { validation?: unknown }).validation) {
      const validation = (error as { validation: unknown[] }).validation;
      reply.status(400).send(err('validation.failed', 'Validation gagal.', { fields: validation }));
      return;
    }

    // Pass through errors that already have a specific HTTP status (e.g. rate-limit 429).
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 400) {
      const msg = error instanceof Error ? error.message : 'Request rejected';
      reply.status(statusCode).send(err('request.rejected', msg));
      return;
    }

    request.log.error({ err: error }, 'unhandled error');
    const rawMessage = error instanceof Error ? error.message : 'Unknown error';
    const message = opts.nodeEnv === 'production' ? 'Terjadi kesalahan pada server.' : rawMessage;
    reply.status(500).send(err('internal.unknown', message));
  });
}
