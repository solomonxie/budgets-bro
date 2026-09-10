import { create } from 'zustand';
import { currentMonth } from '../domain/month';

interface AppState {
  currentMonth: string; // 'YYYY-MM'
  setCurrentMonth: (month: string) => void;

  // `editingTransactionId` is null for "new transaction", set for editing an
  // existing one — same sheet, same fields, prefilled.
  transactionModal: { open: boolean; editingTransactionId: number | null };
  openAddTransaction: () => void;
  openEditTransaction: (id: number) => void;
  closeTransactionModal: () => void;

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

  transactionModal: { open: false, editingTransactionId: null },
  openAddTransaction: () => set({ transactionModal: { open: true, editingTransactionId: null } }),
  openEditTransaction: (id) => set({ transactionModal: { open: true, editingTransactionId: id } }),
  closeTransactionModal: () => set({ transactionModal: { open: false, editingTransactionId: null } }),

  dataVersion: 0,
  bumpDataVersion: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));
