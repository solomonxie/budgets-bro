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
  transactionModal: { open: boolean; editingTransactionId: number | null; presetAccountId: number | null };
  openAddTransaction: (presetAccountId?: number) => void;
  openEditTransaction: (id: number) => void;
  closeTransactionModal: () => void;

  // Same "one sheet, create or edit" pattern as the transaction modal.
  accountModal: { open: boolean; editingAccountId: number | null };
  openAddAccount: () => void;
  openEditAccount: (id: number) => void;
  closeAccountModal: () => void;

  // Same pattern again, for a recurring-transaction schedule (T8.9).
  scheduledTransactionModal: { open: boolean; editingId: number | null };
  openAddScheduledTransaction: () => void;
  openEditScheduledTransaction: (id: number) => void;
  closeScheduledTransactionModal: () => void;

  // Settings lives in a global modal (opened from a corner button on each
  // tab's home screen) instead of its own bottom tab, and doesn't need a
  // navigation stack — SettingsScreen has no navigation dependency itself.
  settingsModal: { open: boolean };
  openSettings: () => void;
  closeSettings: () => void;

  // Bumped after any write (transaction, account, category, budget entry) so
  // read hooks can refetch regardless of navigation focus — a plain Modal
  // (the Add Transaction sheet) doesn't blur the screen behind it, so
  // useFocusEffect alone would miss those writes.
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

  transactionModal: { open: false, editingTransactionId: null, presetAccountId: null },
  openAddTransaction: (presetAccountId) =>
    set({ transactionModal: { open: true, editingTransactionId: null, presetAccountId: presetAccountId ?? null } }),
  openEditTransaction: (id) => set({ transactionModal: { open: true, editingTransactionId: id, presetAccountId: null } }),
  closeTransactionModal: () => set({ transactionModal: { open: false, editingTransactionId: null, presetAccountId: null } }),

  accountModal: { open: false, editingAccountId: null },
  openAddAccount: () => set({ accountModal: { open: true, editingAccountId: null } }),
  openEditAccount: (id) => set({ accountModal: { open: true, editingAccountId: id } }),
  closeAccountModal: () => set({ accountModal: { open: false, editingAccountId: null } }),

  scheduledTransactionModal: { open: false, editingId: null },
  openAddScheduledTransaction: () => set({ scheduledTransactionModal: { open: true, editingId: null } }),
  openEditScheduledTransaction: (id) => set({ scheduledTransactionModal: { open: true, editingId: id } }),
  closeScheduledTransactionModal: () => set({ scheduledTransactionModal: { open: false, editingId: null } }),

  settingsModal: { open: false },
  openSettings: () => set({ settingsModal: { open: true } }),
  closeSettings: () => set({ settingsModal: { open: false } }),

  dataVersion: 0,
  bumpDataVersion: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));
