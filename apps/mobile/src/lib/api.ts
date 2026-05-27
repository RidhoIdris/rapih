import type { ErrorCode } from '@rapih/shared';
import { env } from './env';
import { clearRefreshToken, getRefreshToken, setRefreshToken } from './secure-store';

// ─── Types ────────────────────────────────────────────────────────────────

export type ApiError = {
  code: ErrorCode | string;
  message: string;
  details?: unknown;
  httpStatus: number;
};

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details?: unknown;

  constructor(err: ApiError) {
    super(err.message);
    this.name = 'ApiClientError';
    this.code = err.code;
    this.httpStatus = err.httpStatus;
    this.details = err.details;
  }
}

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

// ─── Access token holder ──────────────────────────────────────────────────

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ─── Refresh-on-401 logic ────────────────────────────────────────────────

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Refresh the access token using the stored refresh token.
 * Returns the new access token on success, or null if the refresh failed
 * (caller should treat null as "user must re-login").
 *
 * Multiple concurrent 401s share a single refresh promise (deduplication).
 */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refresh = await getRefreshToken();
      if (!refresh) return null;

      const res = await fetch(`${env.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });

      if (!res.ok) {
        // Refresh failed → clear stored refresh, force re-login
        await clearRefreshToken();
        return null;
      }

      const body: Envelope<{ access_token: string; refresh_token: string }> = await res.json();
      if (!body.ok) {
        await clearRefreshToken();
        return null;
      }

      accessToken = body.data.access_token;
      await setRefreshToken(body.data.refresh_token);
      return accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// ─── Core request function ───────────────────────────────────────────────

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /**
   * If true, do NOT attach Authorization header even if accessToken exists.
   * Use for sign-in / refresh endpoints.
   */
  skipAuth?: boolean;
  /**
   * If true, do NOT attempt refresh-on-401. Used internally by refresh logic.
   */
  skipRetry?: boolean;
}

export async function apiRequest<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const url = `${env.apiUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (!opts.skipAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  // 204 No Content (e.g. /auth/logout)
  if (res.status === 204) {
    return undefined as T;
  }

  // 401 with auth attached → try refresh once, then retry
  if (res.status === 401 && !opts.skipAuth && !opts.skipRetry && accessToken) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      return apiRequest<T>(path, { ...opts, skipRetry: true });
    }
    // refresh failed → caller should treat as logout
    accessToken = null;
  }

  let body: Envelope<T>;
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError({
      code: 'network.parse_error',
      message: 'Server response invalid.',
      httpStatus: res.status,
    });
  }

  if (!body.ok) {
    throw new ApiClientError({
      code: body.error.code,
      message: body.error.message,
      details: body.error.details,
      httpStatus: res.status,
    });
  }

  return body.data;
}
