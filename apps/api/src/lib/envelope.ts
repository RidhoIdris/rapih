export type Ok<T> = { ok: true; data: T };
export type Err = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};
export type Envelope<T> = Ok<T> | Err;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function err(code: string, message: string, details?: unknown): Err {
  return {
    ok: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}
