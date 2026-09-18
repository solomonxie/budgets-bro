import { focusedAccountId } from './focusedAccount';

const accountsTab = (stack?: object) => ({
  index: 1,
  routes: [{ name: 'Budget' }, { name: 'Accounts', ...stack }],
});

describe('focusedAccountId', () => {
  it('reads the account off an open account page', () => {
    expect(
      focusedAccountId(
        accountsTab({
          state: {
            routes: [{ name: 'AccountsList' }, { name: 'AccountDetail', params: { accountId: 7 } }],
          },
        }),
      ),
    ).toBe(7);
  });

  it('ignores a tab that is not Accounts', () => {
    expect(focusedAccountId({ index: 0, routes: [{ name: 'Budget' }] })).toBeUndefined();
  });

  it('ignores the accounts list itself', () => {
    expect(focusedAccountId(accountsTab({ state: { routes: [{ name: 'AccountsList' }] } }))).toBeUndefined();
  });

  it('ignores a stack that has not rendered yet', () => {
    expect(focusedAccountId(accountsTab())).toBeUndefined();
  });
});
