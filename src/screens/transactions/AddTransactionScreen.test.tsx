import { act, create } from 'react-test-renderer';
import { Modal, Text, TextInput } from 'react-native';
import { AddTransactionScreen } from './AddTransactionScreen';

// Every picker on this page unfolds in the row's own space (see
// components/ui/ExpandingField) — nothing on it may present a Modal over the
// form, and the options must be on screen alongside the fields.
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ setOptions: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('../../db/client', () => ({ getDb: async () => ({}) }));
jest.mock('../../hooks/useAccounts', () => ({
  useAccounts: () => ({
    accounts: [
      { account: { id: 1, name: 'Amex', type: 'credit_card', onBudget: true } },
    ],
    loading: false,
    refresh: jest.fn(),
  }),
}));
jest.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({
    groups: [{ id: 1, name: 'Food' }],
    categories: [{ id: 10, name: 'Groceries', groupId: 1, icon: null }],
  }),
}));
jest.mock('../../hooks/useTrackedPrices', () => ({
  useTrackedPrices: () => ({
    items: [],
    names: ['Olive oil'],
    transactions: [],
    loading: false,
  }),
}));
jest.mock('../../hooks/usePayees', () => ({
  usePayees: () => ({
    payees: [{ id: 5, name: 'Costco', linkedAccountId: null }],
  }),
}));

function texts(root: ReturnType<typeof create>): string[] {
  return root.root.findAllByType(Text).flatMap((t) => {
    const c = t.props.children;
    return typeof c === 'string' ? [c] : [];
  });
}

function placeholders(root: ReturnType<typeof create>): string[] {
  return root.root
    .findAllByType(TextInput)
    .map((i) => i.props.placeholder)
    .filter((p): p is string => typeof p === 'string');
}

function pressRow(root: ReturnType<typeof create>, label: string) {
  const node = root.root
    .findAllByType(Text)
    .find((t) => t.props.children === label)!;
  let p: typeof node | null = node.parent;
  while (p && typeof p.props?.onPress !== 'function') p = p.parent;
  act(() => {
    p!.props.onPress();
  });
}

describe('AddTransactionScreen', () => {
  it.each(['Payee', 'Category', 'Account', 'Date', 'Items'])(
    '%s unfolds in place, presenting no Modal',
    (label) => {
      let root!: ReturnType<typeof create>;
      act(() => {
        root = create(<AddTransactionScreen />);
      });
      expect(texts(root)).toContain(label);

      pressRow(root, label);
      expect(root.root.findAllByType(Modal)).toHaveLength(0);
    },
  );

  it('the unfolded category list shows its options under the row', () => {
    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(<AddTransactionScreen />);
    });
    expect(texts(root)).not.toContain('Groceries');

    pressRow(root, 'Category');
    const shown = texts(root);
    expect(shown).toContain('Groceries');
    // The form is still there behind it — that's the whole point.
    expect(shown).toContain('Account');
  });

  it('Items unfolds into a blank row to type into; the memo is always there', () => {
    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(<AddTransactionScreen />);
    });
    // The memo is a row of the card, on screen with the rest of the form.
    expect(placeholders(root)).toContain('Memo');
    expect(placeholders(root)).not.toContain('Item');

    pressRow(root, 'Items');
    expect(placeholders(root)).toEqual(
      expect.arrayContaining(['Memo', 'Item', 'Price']),
    );
    // The form above it is still there — the section unfolds in place.
    expect(texts(root)).toContain('Account');
  });

  it('the memo is one line, and Return closes it', () => {
    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(<AddTransactionScreen />);
    });
    const memo = root.root
      .findAllByType(TextInput)
      .find((i) => i.props.placeholder === 'Memo')!;
    expect(memo.props.multiline).toBeFalsy();
    expect(memo.props.submitBehavior).toBe('blurAndSubmit');
  });

  it('typing an item offers past names and adds the next blank row', () => {
    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(<AddTransactionScreen />);
    });
    pressRow(root, 'Items');
    const name = () =>
      root.root
        .findAllByType(TextInput)
        .filter((i) => i.props.placeholder === 'Item')[0];
    act(() => {
      name().props.onFocus();
    });
    expect(texts(root)).toContain('Olive oil');

    act(() => {
      name().props.onChangeText('Ol');
    });
    expect(texts(root)).toContain('Olive oil');
    expect(placeholders(root)).toContain('Next item');
    expect(root.root.findAllByType(Modal)).toHaveLength(0);
  });
});
