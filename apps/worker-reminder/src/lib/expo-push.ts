import { loadEnv } from '../config/env.js';
import { logger } from './logger.js';

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type SendResult = {
  ok: { to: string }[];
  removeTokens: string[];
  errors: { to: string; error: string }[];
};

type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

export type FetchFn = typeof fetch;

/**
 * Send push messages via Expo Push API.
 * In test mode, pass a mocked fetch via the `fetchImpl` parameter.
 */
export async function sendPushes(
  messages: PushMessage[],
  fetchImpl: FetchFn = fetch
): Promise<SendResult> {
  const result: SendResult = { ok: [], removeTokens: [], errors: [] };
  if (messages.length === 0) return result;

  const env = loadEnv();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (env.EXPO_ACCESS_TOKEN) {
    headers.authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  }

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetchImpl(EXPO_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk),
      });
      const json = (await res.json()) as { data?: ExpoTicket[]; errors?: unknown[] };
      const tickets = json.data ?? [];
      tickets.forEach((ticket, idx) => {
        const msg = chunk[idx];
        if (!msg) return;
        if (ticket.status === 'ok') {
          result.ok.push({ to: msg.to });
        } else if (ticket.details?.error === 'DeviceNotRegistered') {
          result.removeTokens.push(msg.to);
        } else {
          result.errors.push({ to: msg.to, error: ticket.message });
        }
      });
    } catch (err) {
      logger.error({ err }, 'expo push request failed');
      for (const m of chunk) {
        result.errors.push({ to: m.to, error: 'network_error' });
      }
    }
  }
  return result;
}
