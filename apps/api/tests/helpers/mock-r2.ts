import { vi } from 'vitest';

type Stored = { contentType: string; size: number };

class MockR2 {
  readonly store = new Map<string, Stored>();

  uploadFromKey(key: string, size: number, contentType: string): void {
    this.store.set(key, { size, contentType });
  }

  clear(): void {
    this.store.clear();
  }
}

export const mockR2 = new MockR2();

vi.mock('../../src/lib/r2.js', () => ({
  headObject: vi.fn(async (key: string) => {
    const obj = mockR2.store.get(key);
    if (!obj) return { exists: false, size: 0, contentType: '' };
    return { exists: true, size: obj.size, contentType: obj.contentType };
  }),
  presignGet: vi.fn(
    async (key: string) => `https://mock-r2.local/get/${encodeURIComponent(key)}?expires=300`
  ),
  presignPut: vi.fn(async (key: string, contentType: string, sizeBytes: number) => ({
    url: `https://mock-r2.local/put/${encodeURIComponent(key)}?expires=300`,
    headers: { 'Content-Type': contentType, 'Content-Length': String(sizeBytes) },
  })),
}));
