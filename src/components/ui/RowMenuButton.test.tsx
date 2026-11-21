import { act, create } from 'react-test-renderer';
import { ActionSheetIOS, Platform, Text } from 'react-native';
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

  it('on iOS, shows the system action sheet and runs the picked item', () => {
    Platform.OS = 'ios';
    const show = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => {});
    const onPress = jest.fn();
    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(
        <RowMenuButton
          title="Rent"
          items={[{ label: 'Delete', destructive: true, onPress }]}
        />,
      );
    });
    act(() => {
      findPressableByLabel(root.root, '⋯').props.onPress();
    });
    const [options, pick] = show.mock.calls[0];
    expect(options).toMatchObject({
      title: 'Rent',
      options: ['Delete', 'Cancel'],
      cancelButtonIndex: 1,
      destructiveButtonIndex: [0],
    });
    act(() => pick(1));
    expect(onPress).not.toHaveBeenCalled();
    act(() => pick(0));
    expect(onPress).toHaveBeenCalledTimes(1);
    show.mockRestore();
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
});
