import { create } from 'zustand';

interface AppState {
  currentMonth: string; // 'YYYY-MM'
  setCurrentMonth: (month: string) => void;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export const useAppStore = create<AppState>((set) => ({
  currentMonth: currentMonth(),
  setCurrentMonth: (month) => set({ currentMonth: month }),
}));
