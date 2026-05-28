import { describe, expect, it, vi } from 'vitest';
import './helpers/test-env.js';
import { type FetchFn, sendPushes } from '../src/lib/expo-push.js';

function mockFetch(response: unknown, status = 200): FetchFn {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(response), {
        status,
        headers: { 'content-type': 'application/json' },
      })
  ) as unknown as FetchFn;
}

describe('sendPushes', () => {
  it('does nothing on empty list', async () => {
    const fetchImpl = vi.fn() as unknown as FetchFn;
    const r = await sendPushes([], fetchImpl);
    expect(r.ok).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('parses ok ticket as success', async () => {
    const fetchImpl = mockFetch({ data: [{ status: 'ok', id: 'r1' }] });
    const r = await sendPushes([{ to: 'ExponentPushToken[a]', title: 't', body: 'b' }], fetchImpl);
    expect(r.ok).toEqual([{ to: 'ExponentPushToken[a]' }]);
    expect(r.removeTokens).toEqual([]);
  });

  it('parses DeviceNotRegistered as removeTokens', async () => {
    const fetchImpl = mockFetch({
      data: [{ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }],
    });
    const r = await sendPushes(
      [{ to: 'ExponentPushToken[dead]', title: 't', body: 'b' }],
      fetchImpl
    );
    expect(r.removeTokens).toEqual(['ExponentPushToken[dead]']);
  });

  it('parses generic error into errors list', async () => {
    const fetchImpl = mockFetch({
      data: [{ status: 'error', message: 'MessageTooBig' }],
    });
    const r = await sendPushes([{ to: 'ExponentPushToken[a]', title: 't', body: 'b' }], fetchImpl);
    expect(r.errors).toEqual([{ to: 'ExponentPushToken[a]', error: 'MessageTooBig' }]);
  });

  it('chunks 250 messages into 3 chunks', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      calls++;
      const body = JSON.parse(init?.body as string) as unknown[];
      const data = body.map(() => ({ status: 'ok', id: `r${calls}` }));
      return new Response(JSON.stringify({ data }), { status: 200 });
    }) as unknown as FetchFn;

    const messages = Array.from({ length: 250 }, (_, i) => ({
      to: `ExponentPushToken[${i}]`,
      title: 't',
      body: 'b',
    }));
    const r = await sendPushes(messages, fetchImpl);
    expect(calls).toBe(3);
    expect(r.ok).toHaveLength(250);
  });

  it('network failure marks all messages in chunk as errors', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('econnreset');
    }) as unknown as FetchFn;
    const r = await sendPushes([{ to: 'ExponentPushToken[a]', title: 't', body: 'b' }], fetchImpl);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.error).toBe('network_error');
  });
});
