import { create } from 'zustand';
import { currentMonth } from '../domain/month';

interface AppState {
  currentMonth: string; // 'YYYY-MM'
  setCurrentMonth: (month: string) => void;

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

  transactionModal: { open: false, editingTransactionId: null, presetAccountId: null },
  openAddTransaction: (presetAccountId) =>
    set({ transactionModal: { open: true, editingTransactionId: null, presetAccountId: presetAccountId ?? null } }),
  openEditTransaction: (id) => set({ transactionModal: { open: true, editingTransactionId: id, presetAccountId: null } }),
  closeTransactionModal: () => set({ transactionModal: { open: false, editingTransactionId: null, presetAccountId: null } }),

  accountModal: { open: false, editingAccountId: null },
  openAddAccount: () => set({ accountModal: { open: true, editingAccountId: null } }),
  openEditAccount: (id) => set({ accountModal: { open: true, editingAccountId: id } }),
  closeAccountModal: () => set({ accountModal: { open: false, editingAccountId: null } }),

  dataVersion: 0,
  bumpDataVersion: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));
