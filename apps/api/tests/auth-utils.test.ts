import { describe, expect, it } from 'vitest';
import { parseDeviceLabel } from '../src/auth/device.js';
import { isApplePrivateRelay, normalizeEmail } from '../src/auth/email.js';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  R@Example.COM ')).toBe('r@example.com');
  });
});

describe('isApplePrivateRelay', () => {
  it('detects @privaterelay.appleid.com', () => {
    expect(isApplePrivateRelay('abc123@privaterelay.appleid.com')).toBe(true);
    expect(isApplePrivateRelay('ridho@gmail.com')).toBe(false);
  });
});

describe('parseDeviceLabel', () => {
  it('parses an iOS UA', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
    const label = parseDeviceLabel(ua);
    expect(label).toBeDefined();
    expect(label).toMatch(/iPhone|iOS/i);
  });

  it('parses an Android UA', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
    const label = parseDeviceLabel(ua);
    expect(label).toBeDefined();
    expect(label).toMatch(/Android|Pixel/i);
  });

  it('returns null for missing UA', () => {
    expect(parseDeviceLabel(undefined)).toBeNull();
    expect(parseDeviceLabel('')).toBeNull();
  });
});
