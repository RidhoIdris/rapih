import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

async function userWithToken() {
  const user = await prisma.user.create({
    data: {
      email: `device-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      onboarding_completed_at: new Date(),
      profile: { create: {} },
    },
  });
  const token = signAccessToken({
    userId: user.id,
    tier: 'free',
    secret: process.env.JWT_ACCESS_SECRET as string,
    ttlSeconds: 900,
  });
  return { user, token };
}

describe('devices', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await app.close();
  });

  // ─── Auth guards ──────────────────────────────────────────────────────

  it('POST /devices/register returns 401 without bearer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/devices/register',
      payload: { token: 'ExponentPushToken[abc]', platform: 'ios' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /devices/:token returns 401 without bearer', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/devices/ExponentPushToken%5Babc%5D',
    });
    expect(res.statusCode).toBe(401);
  });

  // ─── Register ─────────────────────────────────────────────────────────

  it('POST /devices/register creates a new device token', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/devices/register',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        token: 'ExponentPushToken[test-abc-123]',
        platform: 'ios',
        label: 'iPhone 15',
      },
    });
    expect(res.statusCode).toBe(200);
    const { device } = res.json().data;
    expect(device.token).toBe('ExponentPushToken[test-abc-123]');
    expect(device.platform).toBe('ios');
    expect(device.label).toBe('iPhone 15');
  });

  it('POST /devices/register with android and no label', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/devices/register',
      headers: { authorization: `Bearer ${token}` },
      payload: { token: 'ExponentPushToken[android-xyz]', platform: 'android' },
    });
    expect(res.statusCode).toBe(200);
    const { device } = res.json().data;
    expect(device.platform).toBe('android');
    expect(device.label).toBeNull();
  });

  it('POST /devices/register upserts same token to new user', async () => {
    const { token: token1, user: user1 } = await userWithToken();
    const { token: token2 } = await userWithToken();

    // user1 registers
    await app.inject({
      method: 'POST',
      url: '/devices/register',
      headers: { authorization: `Bearer ${token1}` },
      payload: { token: 'ExponentPushToken[shared-device]', platform: 'ios' },
    });
    const rowBefore = await prisma.deviceToken.findUnique({
      where: { token: 'ExponentPushToken[shared-device]' },
    });
    expect(rowBefore?.user_id).toBe(user1.id);

    // user2 registers same physical token (device reassigned)
    const res = await app.inject({
      method: 'POST',
      url: '/devices/register',
      headers: { authorization: `Bearer ${token2}` },
      payload: { token: 'ExponentPushToken[shared-device]', platform: 'ios' },
    });
    expect(res.statusCode).toBe(200);
    const rowAfter = await prisma.deviceToken.findUnique({
      where: { token: 'ExponentPushToken[shared-device]' },
    });
    expect(rowAfter?.user_id).not.toBe(user1.id);
  });

  it('POST /devices/register returns 400 for missing platform', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/devices/register',
      headers: { authorization: `Bearer ${token}` },
      payload: { token: 'ExponentPushToken[abc]' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  // ─── Unregister ───────────────────────────────────────────────────────

  it('DELETE /devices/:token removes the device', async () => {
    const { token, user } = await userWithToken();
    await prisma.deviceToken.create({
      data: { user_id: user.id, token: 'ExponentPushToken[del-me]', platform: 'ios' },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/devices/${encodeURIComponent('ExponentPushToken[del-me]')}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
    const row = await prisma.deviceToken.findUnique({
      where: { token: 'ExponentPushToken[del-me]' },
    });
    expect(row).toBeNull();
  });

  it("DELETE /devices/:token returns 404 for another user's token", async () => {
    const { user: other } = await userWithToken();
    await prisma.deviceToken.create({
      data: { user_id: other.id, token: 'ExponentPushToken[other-tok]', platform: 'android' },
    });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'DELETE',
      url: `/devices/${encodeURIComponent('ExponentPushToken[other-tok]')}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('device.not_found');
  });

  it('DELETE /devices/:token returns 404 for non-existent token', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'DELETE',
      url: `/devices/${encodeURIComponent('ExponentPushToken[ghost]')}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('device.not_found');
  });
});
