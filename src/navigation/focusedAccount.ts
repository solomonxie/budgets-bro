// The Spend tab is a plain "+" with no context of its own, but pressing it
// while an account's page is open means "spend from this account" — dig the
// account out of the tab navigator's own state so Add Transaction can
// preselect it, instead of falling back to the last account used.
export interface TabNavState {
  index: number;
  routes: { name: string; params?: object; state?: Partial<TabNavState> }[];
}

export function focusedAccountId(state: TabNavState): number | undefined {
  const tab = state.routes[state.index];
  if (tab?.name !== 'Accounts') return undefined;
  const stack = tab.state;
  // A nested navigator's state can be partial (no `index` until it has
  // rendered past its first screen), so read the top of the stack.
  const top = stack?.routes?.[stack.routes.length - 1];
  if (top?.name !== 'AccountDetail') return undefined;
  return (top.params as { accountId?: number } | undefined)?.accountId;
}
