/**
 * Canonical error codes the API throws. Keep this list in sync with the
 * `ErrorCode` union in `apps/api/src/lib/errors.ts` consumers and with
 * Spine § 7. Add new codes here BEFORE throwing them.
 */
export const ERROR_MESSAGES = {
  'auth.invalid_token': 'Token tidak valid.',
  'auth.token_expired': 'Sesi sudah kadaluarsa, silakan masuk kembali.',
  'auth.token_reused': 'Sesi tidak aman, silakan masuk kembali di semua perangkat.',
  'auth.unauthorized': 'Anda harus masuk dulu.',
  'auth.unsupported_provider': 'Provider tidak dikenali.',
  'onboarding.required': 'Lengkapi onboarding dulu untuk lanjut.',
  'category.not_found': 'Kategori tidak ditemukan.',
  'goal.not_found': 'Goal tidak ditemukan.',
  'transaction.not_found': 'Transaksi tidak ditemukan.',
  'wallet.not_found': 'Dompet tidak ditemukan.',
  'validation.failed': 'Validasi gagal.',
  'internal.unknown': 'Terjadi kesalahan pada server.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export function isErrorCode(s: string): s is ErrorCode {
  return Object.hasOwn(ERROR_MESSAGES, s);
}
