import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getDb } from '../db/client';
import * as boardsRepo from '../db/repositories/boardsRepo';
import { syncIfDue } from '../sync/cloudSync';
import { useAppStore } from '../state/useAppStore';

const DEBOUNCE_MS = 5000;

// Fires an automatic one-way backup (see sync/cloudSync.ts) on data changes
// (debounced) and whenever the app returns to the foreground — not true OS
// background execution (this app ships no background task; see
// docs/design/cloud-sync/DESIGN.md Non-goals), just "while the app happens
// to be open". Mounted once near the app root, same as
// useBootstrapActiveBoard/useBootstrapLanguage.
export function useAutoCloudSync() {
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSync = useCallback(async () => {
    const db = await getDb();
    const boards = await boardsRepo.listBoards(db);
    const board = boards.find((b) => b.id === boardId);
    if (!board) return;
    // No-ops when every destination's switch is off, and now also when a
    // destination was backed up within the day and nothing has changed since
    // (see cloudSync.syncIfDue). Tapping Back Up Now still goes straight
    // through syncNow — asking for it means now.
    await syncIfDue(db, boardId, board.name);
  }, [boardId]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(runSync, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dataVersion, runSync]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runSync();
    });
    return () => sub.remove();
  }, [runSync]);
}
