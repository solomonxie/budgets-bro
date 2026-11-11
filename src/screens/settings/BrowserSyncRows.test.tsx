import { act, create } from 'react-test-renderer';
import { Switch, Text } from 'react-native';
import { BrowserSyncRows } from './BrowserSyncRows';
import type { BrowserSyncView } from './BrowserSyncRows';
import type { BrowserSyncStatus } from '../../sync/browserSync';

const on: BrowserSyncStatus = {
  enabled: true,
  homeConfig: 'c1',
  lastSynced: Date.now(),
  pending: 0,
  error: null,
  fatal: null,
};

const view = (status: Partial<BrowserSyncStatus> | null, extra: Partial<BrowserSyncView> = {}): BrowserSyncView => ({
  demo: false,
  status: status ? { ...on, ...status } : null,
  homeBucket: 'my-bucket',
  deviceCount: 2,
  conflictCount: 0,
  ...extra,
});

function render(v: BrowserSyncView, configId = 'c1') {
  const handlers = { onToggle: jest.fn(), onSyncNow: jest.fn(), onOpenDevices: jest.fn(), onOpenConflicts: jest.fn() };
  let root!: ReturnType<typeof create>;
  act(() => {
    root = create(<BrowserSyncRows configId={configId} view={v} {...handlers} />);
  });
  const texts = root.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
  const toggle = root.root.findByType(Switch).props;
  return { texts, toggle, handlers, root };
}

describe('BrowserSyncRows', () => {
  it('off: only the switch, with the hint', () => {
    const { texts, toggle } = render(view({ enabled: false }));
    expect(texts).toEqual(['Sync with browser', 'Edit this budget from Chrome too']);
    expect(toggle.value).toBe(false);
    expect(toggle.disabled).toBe(false);
  });

  it('synced: status, devices count, no conflicts row', () => {
    const { texts, toggle } = render(view({}));
    expect(texts).toEqual(['Sync with browser', 'Synced just now', 'Devices', '2', '›']);
    expect(toggle.value).toBe(true);
  });

  it('publishing, waiting, offline, provider error, stopped', () => {
    expect(render(view({ lastSynced: null, pending: 40 })).texts[1]).toBe('Publishing your boards… 40');
    expect(render(view({ pending: 3 })).texts[1]).toBe('3 waiting');
    expect(render(view({ error: { kind: 'offline', detail: 'x', at: 0 } })).texts[1]).toBe('Offline');
    expect(render(view({ error: { kind: 'auth', detail: 'AccessDenied: Access Denied', at: 0 } })).texts[1]).toBe(
      'AccessDenied: Access Denied',
    );
    expect(render(view({ fatal: { kind: 'newer', detail: 'v2', at: 0 } })).texts[1]).toBe(
      'Sync stopped: update the app to keep syncing',
    );
  });

  it('another bucket is home: disabled with where sync lives', () => {
    const { texts, toggle } = render(view({}), 'c2');
    expect(texts).toEqual(['Sync with browser', 'Browser sync uses my-bucket']);
    expect(toggle.disabled).toBe(true);
  });

  it('demo: disabled, not available', () => {
    const { texts, toggle } = render(view({ enabled: false }, { demo: true }));
    expect(texts).toEqual(['Sync with browser', 'Not available on the demo board']);
    expect(toggle.disabled).toBe(true);
  });

  it('shows and opens the conflicts row only when there are some', () => {
    const { texts, handlers, root } = render(view({}, { conflictCount: 1 }));
    expect(texts).toContain('Edited in two places');
    let node = root.root.findAllByType(Text).find((t) => t.props.children === 'Edited in two places')!.parent;
    while (node && typeof node.props.onPress !== 'function') node = node.parent;
    act(() => node!.props.onPress());
    expect(handlers.onOpenConflicts).toHaveBeenCalled();
  });
});
