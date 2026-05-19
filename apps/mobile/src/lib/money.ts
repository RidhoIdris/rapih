/**
 * Indonesian rupiah formatter.
 *
 *   rupiah(5450000)               → "Rp 5.450.000"
 *   rupiah(-5450000)              → "−Rp 5.450.000"
 *   rupiah(5450000, { short })    → "Rp 5,4jt"
 *   rupiah(1_400_000_000, short ) → "Rp 1,4M"
 *
 * `short` uses Indonesian magnitude suffixes: rb (ribu), jt (juta), M (miliar)
 * and a comma as the decimal separator.
 */
export function rupiah(n: number, { short = false }: { short?: boolean } = {}): string {
  if (short) {
    const abs = Math.abs(n);
    if (abs >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1).replace('.', ',') + 'M';
    if (abs >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1).replace('.', ',') + 'jt';
    if (abs >= 1e3) return 'Rp ' + Math.round(n / 1e3) + 'rb';
    return 'Rp ' + n;
  }
  const grouped = Math.abs(Math.round(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '−Rp ' : 'Rp ') + grouped;
}
