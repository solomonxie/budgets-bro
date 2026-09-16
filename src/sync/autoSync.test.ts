import { resolveAutoSync } from './autoSync';

// Auto-sync moved from one global switch to a setting per destination. The
// rule that matters is what happens to someone who had already turned the old
// switch off — they must not silently start syncing again.
describe('resolveAutoSync', () => {
  it('defaults to on when nothing was ever set', () => {
    expect(resolveAutoSync(null, null)).toBe(true);
  });

  it('inherits the retired global switch when the destination has no setting', () => {
    expect(resolveAutoSync(null, 'false')).toBe(false);
    expect(resolveAutoSync(null, 'true')).toBe(true);
  });

  it('lets a destination override the global one in both directions', () => {
    expect(resolveAutoSync('true', 'false')).toBe(true);
    expect(resolveAutoSync('false', 'true')).toBe(false);
  });
});
