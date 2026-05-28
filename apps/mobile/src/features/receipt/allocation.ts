export type RawItem = { name: string; qty: number; subtotal: number; unit_price: number };

export function allocateProportional(items: RawItem[], total: number): number[] {
  if (items.length === 0) return [];
  const sumSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  if (sumSubtotal === 0) return items.map(() => 0);
  const out = items.map((item) => Math.round((item.subtotal / sumSubtotal) * total));
  const diff = total - out.reduce((sum, value) => sum + value, 0);
  out[out.length - 1] += diff;
  return out;
}
