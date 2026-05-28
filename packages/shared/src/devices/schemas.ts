import { z } from 'zod';

export const DevicePlatformSchema = z.enum(['ios', 'android']);
export type DevicePlatform = z.infer<typeof DevicePlatformSchema>;

// ─── Request bodies ───────────────────────────────────────────────────────

export const RegisterDeviceBody = z.object({
  token: z.string().trim().min(1).max(500),
  platform: DevicePlatformSchema,
  label: z.string().trim().max(100).nullable().optional(),
});
export type RegisterDeviceBody = z.infer<typeof RegisterDeviceBody>;

// ─── DTOs ─────────────────────────────────────────────────────────────────

export const DeviceTokenDto = z.object({
  id: z.string(),
  token: z.string(),
  platform: DevicePlatformSchema,
  label: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type DeviceTokenDto = z.infer<typeof DeviceTokenDto>;

// ─── Response envelopes ───────────────────────────────────────────────────

export const DeviceTokenResponse = z.object({
  ok: z.literal(true),
  data: z.object({ device: DeviceTokenDto }),
});
export type DeviceTokenResponse = z.infer<typeof DeviceTokenResponse>;
