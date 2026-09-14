import { act, create } from 'react-test-renderer';
import { Modal, Platform, Text } from 'react-native';
import { RowMenuButton } from './RowMenuButton';

// Regression test for the delete-board freeze: an item's onPress used to
// fire in the same tick as this sheet's own dismissal, stacking two native
// modal transitions and wedging iOS's window presentation state. It must
// now wait for the sheet's own Modal to report (via onDismiss) that it has
// actually finished closing.
// Text's immediate `.parent` isn't necessarily the Pressable itself —
// Pressable wraps its child in host-level View(s) — so walk up until we
// hit the actual Pressable composite instance. Matched by displayName
// rather than `=== Pressable`: jest-expo resolves the import in this test
// file to a different module instance than RowMenuButton.tsx's, so the
// two references aren't `===` even though both really are RN's Pressable.
function isPressableType(type: unknown): boolean {
  const t = type as { displayName?: string; name?: string } | null;
  return t?.displayName === 'Pressable' || t?.name === 'Pressable';
}

function findPressableByLabel(root: ReturnType<typeof create>['root'], label: string) {
  let node = root.findAllByType(Text).find((t) => t.props.children === label)!.parent;
  while (node && !isPressableType(node.type)) node = node.parent;
  return node!;
}

describe('RowMenuButton', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('on iOS, waits for the sheet Modal to dismiss before running the tapped item', () => {
    Platform.OS = 'ios';
    const onPress = jest.fn();
    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(<RowMenuButton items={[{ label: 'Delete', onPress }]} />);
    });

    act(() => {
      findPressableByLabel(root.root, '⋯').props.onPress();
    });
    act(() => {
      findPressableByLabel(root.root, 'Delete').props.onPress();
    });
    expect(onPress).not.toHaveBeenCalled();

    act(() => {
      root.root.findByType(Modal).props.onDismiss();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('on Android, runs the tapped item immediately (no onDismiss to wait on)', () => {
    Platform.OS = 'android';
    const onPress = jest.fn();
    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(<RowMenuButton items={[{ label: 'Delete', onPress }]} />);
    });

    act(() => {
      findPressableByLabel(root.root, '⋯').props.onPress();
    });
    act(() => {
      findPressableByLabel(root.root, 'Delete').props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('closing without tapping an item never fires anything', () => {
    Platform.OS = 'ios';
    const onPress = jest.fn();
    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(<RowMenuButton items={[{ label: 'Delete', onPress }]} />);
    });

    act(() => {
      findPressableByLabel(root.root, '⋯').props.onPress();
    });
    act(() => {
      root.root.findByType(Modal).props.onDismiss();
    });
    expect(onPress).not.toHaveBeenCalled();
  });
});
