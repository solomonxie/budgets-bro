import { resolveSyncEnabled } from './autoSync';

describe('resolveSyncEnabled', () => {
  it('uses the destination switch once it has been touched', () => {
    expect(resolveSyncEnabled('true', null, 'false', false)).toBe(true);
    expect(resolveSyncEnabled('false', 'true', 'true', true)).toBe(false);
  });

  it('keeps anyone who turned the old global switch off turned off', () => {
    expect(resolveSyncEnabled(null, 'true', 'false', true)).toBe(false);
  });

  it('inherits the old per-destination flag before the fallback', () => {
    expect(resolveSyncEnabled(null, 'false', null, true)).toBe(false);
    expect(resolveSyncEnabled(null, 'true', null, false)).toBe(true);
  });

  it('falls back per destination when nothing was ever stored', () => {
    expect(resolveSyncEnabled(null, null, null, true)).toBe(true);
    expect(resolveSyncEnabled(null, null, null, false)).toBe(false);
  });
});
