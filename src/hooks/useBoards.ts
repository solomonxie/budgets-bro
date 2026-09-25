import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as boardsRepo from '../db/repositories/boardsRepo';
import * as accountsRepo from '../db/repositories/accountsRepo';
import * as settingsRepo from '../db/repositories/settingsRepo';
import type { Board } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

const ACTIVE_BOARD_KEY = 'active_board_id';
export const FIRST_RUN_DONE_KEY = 'demo_board_seeded';

// Restores whichever board was active last session — mounted once near the
// app root so every screen sees the right board from the start, not just
// after the user happens to visit Settings.
export function useBootstrapActiveBoard() {
  const setCurrentBoardId = useAppStore((s) => s.setCurrentBoardId);
  useEffect(() => {
    (async () => {
      const db = await getDb();
      const saved = await settingsRepo.getSetting(db, ACTIVE_BOARD_KEY);
      if (saved) setCurrentBoardId(Number(saved));
    })();
  }, [setCurrentBoardId]);
}

// First launch only: the choice between an empty board, the demo board and a
// backup (screens/onboarding/FirstRunPrompt). Once made — any of the three —
// it is never asked again. The key predates the prompt: installs that got
// the demo board automatically already have it set and skip the question.
export function useFirstRunPending(): [boolean, () => Promise<void>] {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    (async () => {
      const db = await getDb();
      setPending(!(await settingsRepo.getSetting(db, FIRST_RUN_DONE_KEY)));
    })();
  }, []);
  const done = useCallback(async () => {
    const db = await getDb();
    await settingsRepo.setSetting(db, FIRST_RUN_DONE_KEY, '1');
    setPending(false);
  }, []);
  return [pending, done];
}

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const currentBoardId = useAppStore((s) => s.currentBoardId);
  const setCurrentBoardId = useAppStore((s) => s.setCurrentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setBoards(await boardsRepo.listBoards(db));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  const switchBoard = useCallback(
    async (id: number) => {
      setCurrentBoardId(id);
      const db = await getDb();
      await settingsRepo.setSetting(db, ACTIVE_BOARD_KEY, String(id));
    },
    [setCurrentBoardId],
  );

  const addBoard = useCallback(
    async (name: string) => {
      const db = await getDb();
      const id = await boardsRepo.createBoard(db, name);
      // Seed the common starting pair so a brand-new board isn't unusable
      // until the user manually adds accounts.
      await accountsRepo.createAccount(db, id, {
        name: 'Cash',
        type: 'cash',
        openingBalanceCents: 0,
      });
      await accountsRepo.createAccount(db, id, {
        name: 'Savings',
        type: 'savings',
        openingBalanceCents: 0,
      });
      bumpDataVersion();
      return id;
    },
    [bumpDataVersion],
  );

  const renameBoard = useCallback(
    async (id: number, name: string) => {
      const db = await getDb();
      await boardsRepo.renameBoard(db, id, name);
      bumpDataVersion();
    },
    [bumpDataVersion],
  );

  // Falls back to whatever board is left after deleting the active one —
  // there's always at least one, since the bootstrap board can't be deleted.
  const removeBoard = useCallback(
    async (id: number) => {
      const db = await getDb();
      await boardsRepo.deleteBoard(db, id);
      if (currentBoardId === id) {
        const fallback = boards.find((b) => b.id !== id)?.id ?? 1;
        await switchBoard(fallback);
      }
      bumpDataVersion();
    },
    [currentBoardId, boards, switchBoard, bumpDataVersion],
  );

  return {
    boards,
    currentBoardId,
    switchBoard,
    addBoard,
    renameBoard,
    removeBoard,
    refresh,
  };
}
