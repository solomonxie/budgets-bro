export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-$' : '$';
  const abs = Math.abs(cents) / 100;
  const hasCents = Math.round(abs * 100) % 100 !== 0;
  const str = abs.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return sign + str;
}
