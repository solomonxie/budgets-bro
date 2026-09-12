import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as boardsRepo from '../db/repositories/boardsRepo';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { seedDemoBoard } from '../db/seed/demoBoard';
import type { Board } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

const ACTIVE_BOARD_KEY = 'active_board_id';
const DEMO_BOARD_SEEDED_KEY = 'demo_board_seeded';

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

// Gives every install a "Show Others" demo board (fake, higher-end finances)
// to switch to before showing someone the app — once only, ever, tracked by
// a settings flag rather than re-checked by name so deleting it doesn't
// bring it back uninvited. Settings' "Create Demo Board" button reuses
// seedDemoBoard directly for a deliberate, on-demand re-creation instead.
export function useEnsureDemoBoard() {
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  useEffect(() => {
    (async () => {
      const db = await getDb();
      const seeded = await settingsRepo.getSetting(db, DEMO_BOARD_SEEDED_KEY);
      if (seeded) return;
      await seedDemoBoard(db);
      await settingsRepo.setSetting(db, DEMO_BOARD_SEEDED_KEY, '1');
      bumpDataVersion();
    })();
  }, [bumpDataVersion]);
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

  return { boards, currentBoardId, switchBoard, addBoard, renameBoard, removeBoard, refresh };
}
