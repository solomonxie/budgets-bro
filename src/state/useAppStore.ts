import { create } from 'zustand';
import { currentMonth } from '../domain/month';

interface AppState {
  currentMonth: string; // 'YYYY-MM'
  setCurrentMonth: (month: string) => void;

  isAddTransactionOpen: boolean;
  openAddTransaction: () => void;
  closeAddTransaction: () => void;

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

  isAddTransactionOpen: false,
  openAddTransaction: () => set({ isAddTransactionOpen: true }),
  closeAddTransaction: () => set({ isAddTransactionOpen: false }),

  dataVersion: 0,
  bumpDataVersion: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));
