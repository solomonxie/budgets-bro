// Chinese mortgage figures are quoted in 万元 (1 万元 = 10,000 元), so the
// 提前还贷 calculator lets the amount fields switch unit. Everything past the
// field boundary is still cents (分), like the rest of the app.
export const CENTS_PER_WAN = 1_000_000;

export function wanToCents(wan: number): number {
  return Math.round(wan * CENTS_PER_WAN);
}

export function centsToWan(cents: number): number {
  return cents / CENTS_PER_WAN;
}
