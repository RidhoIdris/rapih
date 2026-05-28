import { vi } from 'vitest';
import type { FetchFn } from '../../src/lib/expo-push.js';

type TicketResult = { status: 'ok'; id: string } | { status: 'error'; details: { error: string } };

/**
 * Build a fetch mock that returns one ticket per outgoing message. Caller can
 * override per-message status via the `responder` function.
 */
export function makeExpoMock(
  responder: (msg: { to: string }) => TicketResult = () => ({ status: 'ok', id: 'r' })
): { fetchImpl: FetchFn; calls: { to: string }[][] } {
  const calls: { to: string }[][] = [];
  const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string) as { to: string }[];
    calls.push(body);
    const data = body.map(responder);
    return new Response(JSON.stringify({ data }), { status: 200 });
  }) as unknown as FetchFn;
  return { fetchImpl, calls };
}
