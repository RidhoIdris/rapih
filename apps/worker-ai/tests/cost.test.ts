import { describe, expect, it } from 'vitest';
import { computeCost } from '../src/lib/cost.js';

describe('computeCost', () => {
  it('gpt-4o-mini: 1000 prompt + 1000 completion → ~0.00075 USD', async () => {
    const c = computeCost('gpt-4o-mini', 1000, 1000);
    expect(c.toString()).toBe('0.00075');
  });

  it('unknown model → 0', async () => {
    const c = computeCost('totally-fake-model', 1000, 1000);
    expect(c.toString()).toBe('0');
  });

  it('result has 6-decimal precision', async () => {
    const c = computeCost('gpt-4o-mini', 1, 1);
    // (1/1000 * 0.00015) + (1/1000 * 0.0006) = 0.00000075 → rounds to 0.000001 at 6 decimals
    expect(c.toString()).toBe('0.000001');
  });
});
