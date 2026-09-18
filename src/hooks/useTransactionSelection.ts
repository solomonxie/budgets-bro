import { useCallback, useState } from 'react';

// Select mode for any transaction list: long-press a row to enter it, tap to
// add or drop rows, act on the set, leave. Shared so the account page and the
// all-transactions page behave the same way rather than each growing its own
// half of the feature.
export function useTransactionSelection() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const exit = useCallback(() => {
    setSelectMode(false);
    setSelectedIds([]);
  }, []);

  // Long-press starts the mode with that row already picked — entering select
  // mode and then having to tap the row you pressed would be a wasted step.
  const beginWith = useCallback((id: number) => {
    setSelectMode(true);
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const toggle = useCallback((id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  // One control for both directions: everything visible is selected, so the
  // useful next action is clearing it.
  const toggleAll = useCallback((ids: number[]) => {
    setSelectedIds((prev) => (prev.length >= ids.length ? [] : ids));
  }, []);

  return { selectMode, selectedIds, beginWith, toggle, toggleAll, exit, setSelectMode };
}
