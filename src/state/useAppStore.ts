import { create } from 'zustand';
import { currentMonth } from '../domain/month';
import type { Language } from '../i18n';

interface AppState {
  currentMonth: string; // 'YYYY-MM'
  setCurrentMonth: (month: string) => void;

  // Restored from settingsRepo by useBootstrapLanguage (see hooks/useLanguage)
  // — read by useT()/useI18n() everywhere else, same "DB-free store, hook
  // does the persisting" split as currentBoardId/useBootstrapActiveBoard.
  language: Language;
  setLanguage: (language: Language) => void;

  // Which board (tenant/namespace) every screen reads and writes —
  // persisted separately via useBoards' bootstrap effect, not here (this
  // store stays DB-free).
  currentBoardId: number;
  setCurrentBoardId: (id: number) => void;

  // `editingTransactionId` is null for "new transaction", set for editing an
  // existing one — same sheet, same fields, prefilled. `presetAccountId` is
  // only used for "new" (opened from an account page — defaults the account
  // picker to that account instead of the first account in the list).
  // Add Transaction is a pushed page now, so its form unmounts on every
  // exit — these carry the "same account as last time" default that used to
  // survive in the sheet's own state.
  lastAccountId: number | null;
  rememberTransactionAccounts: (accountId: number | null) => void;

  // Same "one sheet, create or edit" pattern as the transaction modal.
  accountModal: { open: boolean; editingAccountId: number | null };
  openAddAccount: () => void;
  openEditAccount: (id: number) => void;
  closeAccountModal: () => void;

  // Settings lives in a global modal (opened from a corner button on each
  // tab's home screen) instead of its own bottom tab, and doesn't need a
  // navigation stack — SettingsScreen has no navigation dependency itself.
  settingsModal: { open: boolean };
  openSettings: () => void;
  closeSettings: () => void;

  // Bumped after any write (transaction, account, category, budget entry) so
  // read hooks can refetch regardless of navigation focus — the account and
  // settings modals don't blur the screen behind them, so useFocusEffect
  // alone would miss those writes.
  dataVersion: number;
  bumpDataVersion: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentMonth: currentMonth(),
  setCurrentMonth: (month) => set({ currentMonth: month }),

  language: 'en',
  setLanguage: (language) => set({ language }),

  currentBoardId: 1,
  setCurrentBoardId: (id) => set({ currentBoardId: id }),

  lastAccountId: null,
  rememberTransactionAccounts: (accountId) => set({ lastAccountId: accountId }),

  accountModal: { open: false, editingAccountId: null },
  openAddAccount: () =>
    set({ accountModal: { open: true, editingAccountId: null } }),
  openEditAccount: (id) =>
    set({ accountModal: { open: true, editingAccountId: id } }),
  closeAccountModal: () =>
    set({ accountModal: { open: false, editingAccountId: null } }),

  settingsModal: { open: false },
  openSettings: () => set({ settingsModal: { open: true } }),
  closeSettings: () => set({ settingsModal: { open: false } }),

  dataVersion: 0,
  bumpDataVersion: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));
