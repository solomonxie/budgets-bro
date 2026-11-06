import { bytesToHex, utf8ToBytes } from './bytes';
import { sha256 } from './sha256';

export interface ForeignKey {
  to: string;
  nullable: boolean;
}

export interface EntitySchema {
  fks: Readonly<Record<string, ForeignKey>>;
  text: ReadonlySet<string>;
}

const board = { board_id: { to: 'boards', nullable: false } };
const ref = (to: string, nullable = true): ForeignKey => ({ to, nullable });
const schema = (fks: Record<string, ForeignKey>, text: string[]): EntitySchema => ({
  fks,
  text: new Set(text),
});

// PROTOCOL.md "Entities (v1)". LWW fields need no listing: anything not an FK
// or text field is LWW.
export const entities: Readonly<Record<string, EntitySchema>> = {
  boards: schema({}, ['name']),
  accounts: schema({ ...board, loan_payment_category_id: ref('categories') }, ['name', 'note']),
  category_groups: schema({ ...board }, ['name']),
  categories: schema(
    { ...board, group_id: ref('category_groups', false), linked_account_id: ref('accounts') },
    ['name'],
  ),
  budget_entries: schema({ ...board, category_id: ref('categories', false) }, []),
  payees: schema({ ...board, linked_account_id: ref('accounts') }, ['name', 'review_note']),
  transactions: schema(
    {
      ...board,
      account_id: ref('accounts', false),
      category_id: ref('categories'),
      payee_id: ref('payees'),
      transfer_account_id: ref('accounts'),
    },
    ['memo'],
  ),
  scheduled_transactions: schema(
    {
      ...board,
      account_id: ref('accounts', false),
      category_id: ref('categories'),
      payee_id: ref('payees'),
    },
    ['memo', 'review_note'],
  ),
  custom_goals: schema({ ...board, linked_account_id: ref('accounts') }, ['name']),
  payment_decisions: schema(
    { ...board, scheduled_transaction_id: ref('scheduled_transactions'), payee_id: ref('payees') },
    ['name', 'note'],
  ),
  account_value_history: schema({ account_id: ref('accounts', false) }, ['note']),
  account_rate_history: schema({ account_id: ref('accounts', false) }, ['note']),
  houses: schema({ ...board }, ['name', 'notes', 'pros', 'cons', 'issues', 'renovations']),
  community_prices: schema({ ...board }, ['note']),
  house_prices: schema({ house_id: ref('houses', false) }, []),
};

// Live rows with equal values here collapse onto the smallest gid.
export const naturalKeys: Readonly<Record<string, readonly string[]>> = {
  payees: ['board_id', 'name'],
  transactions: ['board_id', 'import_id'],
};

export const isTextField = (e: string, f: string): boolean => entities[e]?.text.has(f) ?? false;

export const budgetEntryGid = (categoryGid: string, month: string): string =>
  'be:' + bytesToHex(sha256(utf8ToBytes(`${categoryGid}|${month}`))).slice(0, 32);
