import { act, create } from 'react-test-renderer';
import { Modal, Platform, Text } from 'react-native';
import { DropdownField } from './DropdownField';
import { ExpandingFieldGroup } from './ExpandingField';

// Regression test for the delete-board freeze: `close(after)` used to run
// `after` in the same tick as this picker's own dismissal, stacking two
// native modal transitions and wedging iOS's window presentation state
// (see RowMenuButton.test.tsx for the other half of the fix). `after` must
// wait for this sheet's own Modal to report (via onDismiss) that it has
// actually finished closing.
function isPressableType(type: unknown): boolean {
  const t = type as { displayName?: string; name?: string } | null;
  return t?.displayName === 'Pressable' || t?.name === 'Pressable';
}

// findAllByType(Text)[0] would be the label above the field ("Boards"),
// not the field itself — match the placeholder text instead.
function findText(root: ReturnType<typeof create>, text: string) {
  return root.root.findAllByType(Text).find((t) => t.props.children === text);
}

function findFieldPressable(root: ReturnType<typeof create>['root']) {
  let node = root.findAllByType(Text).find((t) => t.props.children === 'Select…')!.parent;
  while (node && !isPressableType(node.type)) node = node.parent;
  return node!;
}

describe('DropdownField', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('compact: on iOS, defers close(after) until the sheet Modal dismisses', () => {
    Platform.OS = 'ios';
    const after = jest.fn();
    let closeFn!: (after?: () => void) => void;
    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(
        <DropdownField label="Boards" valueLabel="" compact>
          {(close) => {
            closeFn = close;
            return null;
          }}
        </DropdownField>,
      );
    });

    act(() => {
      findFieldPressable(root.root).props.onPress();
    });
    act(() => {
      closeFn(after);
    });
    expect(after).not.toHaveBeenCalled();

    act(() => {
      root.root.findByType(Modal).props.onDismiss();
    });
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('compact: on Android, runs close(after) immediately', () => {
    Platform.OS = 'android';
    const after = jest.fn();
    let closeFn!: (after?: () => void) => void;
    act(() => {
      create(
        <DropdownField label="Boards" valueLabel="" compact>
          {(close) => {
            closeFn = close;
            return null;
          }}
        </DropdownField>,
      );
    });

    act(() => {
      closeFn(after);
    });
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('close() with no argument never calls anything on dismiss', () => {
    Platform.OS = 'ios';
    let closeFn!: (after?: () => void) => void;
    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(
        <DropdownField label="Boards" valueLabel="" compact>
          {(close) => {
            closeFn = close;
            return null;
          }}
        </DropdownField>,
      );
    });

    act(() => {
      closeFn();
    });
    expect(() => {
      act(() => {
        root.root.findByType(Modal).props.onDismiss();
      });
    }).not.toThrow();
  });

  // Inside a group the options unfold in the row's own space — nothing is
  // presented over the page, so there is no Modal to wait for at all.
  it('inside an ExpandingFieldGroup, expands in place instead of presenting a Modal', () => {
    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(
        <ExpandingFieldGroup>
          <DropdownField label="Boards" valueLabel="" compact>
            {() => <Text>Only board</Text>}
          </DropdownField>
        </ExpandingFieldGroup>,
      );
    });
    expect(root.root.findAllByType(Modal)).toHaveLength(0);
    expect(findText(root, 'Only board')).toBeUndefined();

    act(() => {
      findFieldPressable(root.root).props.onPress();
    });
    expect(root.root.findAllByType(Modal)).toHaveLength(0);
    expect(findText(root, 'Only board')).toBeDefined();

    // Tapping the row again folds it away.
    act(() => {
      findFieldPressable(root.root).props.onPress();
    });
    expect(findText(root, 'Only board')).toBeUndefined();
  });

  it('inline: close(after) runs it immediately — no dismissal to wait for', () => {
    const after = jest.fn();
    let closeFn!: (after?: () => void) => void;
    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(
        <ExpandingFieldGroup>
          <DropdownField label="Boards" valueLabel="" compact>
            {(close) => {
              closeFn = close;
              return null;
            }}
          </DropdownField>
        </ExpandingFieldGroup>,
      );
    });
    // Collapsed, the render prop is never called — open the row first.
    act(() => {
      findFieldPressable(root.root).props.onPress();
    });
    act(() => {
      closeFn(after);
    });
    expect(after).toHaveBeenCalledTimes(1);
  });
});
