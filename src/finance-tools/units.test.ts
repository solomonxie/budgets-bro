import { CENTS_PER_WAN, centsToWan, wanToCents } from './units';

describe('wanToCents', () => {
  it('converts 万元 to cents', () => {
    expect(wanToCents(1)).toBe(CENTS_PER_WAN);
    expect(wanToCents(120)).toBe(120_000_000);
  });

  it('rounds to a whole fen', () => {
    expect(wanToCents(0.000_000_4)).toBe(0);
    expect(wanToCents(0.000_000_6)).toBe(1);
  });
});

describe('centsToWan', () => {
  it('round-trips through wanToCents', () => {
    expect(centsToWan(wanToCents(87.5))).toBe(87.5);
  });
});
