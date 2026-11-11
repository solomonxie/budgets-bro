import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { ConflictCard } from './ConflictCard';
import type { FieldConflict } from '../../sync/conflicts';

const conflict: FieldConflict = {
  table: 'transactions',
  gid: 'T1',
  field: 'memo',
  current: { value: 'Sept pay + bonus', device: 'phone', deviceName: null, mine: true, at: Date.now() },
  others: [{ value: 'September salary', device: 'b', deviceName: 'Chrome', mine: false, at: Date.now() - 120_000 }],
  stamps: [],
};

const texts = (root: ReturnType<typeof create>['root']) =>
  root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));

function pressByLabel(root: ReturnType<typeof create>['root'], label: string) {
  let node = root.findAllByType(Text).find((t) => t.props.children === label)!.parent;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  act(() => node!.props.onPress());
}

describe('ConflictCard', () => {
  it('shows both values with who and when, and picks either', () => {
    const onPick = jest.fn();
    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(<ConflictCard conflict={conflict} fieldLabel="Memo" onPick={onPick} />);
    });
    expect(texts(root.root)).toEqual([
      '⚠ Memo edited in two places',
      'This iPhone:',
      'Sept pay + bonus',
      'Chrome · 2 min ago:',
      'September salary',
      'Keep this',
      'Use Chrome’s',
    ]);
    pressByLabel(root.root, 'Use Chrome’s');
    expect(onPick).toHaveBeenLastCalledWith('September salary');
    pressByLabel(root.root, 'Keep this');
    expect(onPick).toHaveBeenLastCalledWith('Sept pay + bonus');
  });
});
