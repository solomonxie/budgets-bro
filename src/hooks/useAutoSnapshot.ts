import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getDb } from '../db/client';
import * as settingsRepo from '../db/repositories/settingsRepo';
import * as boardsRepo from '../db/repositories/boardsRepo';
import * as changeLogRepo from '../db/repositories/changeLogRepo';
import { takeSnapshot } from '../db/preMigrationSnapshot';
import { writeDailyBackup } from '../backup/localBackup';
import { useAppStore } from '../state/useAppStore';

const LAST_SNAPSHOT_SEQ = 'last_snapshot_seq';
const LAST_SNAPSHOT_AT = 'last_snapshot_at';
const SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Two local copies put aside when the app goes to the background, at most
// once a day, and only if anything was written since the last one: the
// database file itself, and the same backup zip every cloud destination gets
// — the latter into the Files-visible Backups folder, so it can be dragged
// out of the phone without this app's help (see backup/localBackup.ts).
//
// This is the local half of keeping data safe, and it is worth being precise
// about which half. It does not survive deleting the app — nothing in the
// app's own storage does, on iOS — so it is no answer to a lost phone; the
// cloud zips are. What it answers is the other failure: data that is still
// there but now wrong, where what you want is yesterday's copy, immediately,
// without a network.
//
// On background rather than on every change: a snapshot is the whole file,
// and copying megabytes per keystroke to protect against something that
// happens once a year is the wrong trade. The change log already records
// every individual write (see changeLogRepo), so nothing is actually
// unrecoverable between snapshots.
export function useAutoSnapshot(): void {
  const running = useRef(false);
  const boardId = useAppStore((s) => s.currentBoardId);

  useEffect(() => {
    const maybeSnapshot = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const db = await getDb();
        const seq = await changeLogRepo.latestChangeSeq(db);
        const lastSeq = await settingsRepo.getSetting(db, LAST_SNAPSHOT_SEQ);
        if (lastSeq != null && Number(lastSeq) === seq) return;

        const lastAt = await settingsRepo.getSetting(db, LAST_SNAPSHOT_AT);
        if (lastAt != null && Date.now() - new Date(lastAt).getTime() < SNAPSHOT_INTERVAL_MS) return;

        // Without this the copy can be missing the newest commits, which sit
        // in the -wal sidecar until a checkpoint folds them in.
        await db.execAsync('PRAGMA wal_checkpoint(FULL)');
        takeSnapshot('budgetsbro.db', 0, 0);

        // After the checkpoint, so the zip and the .db copy describe the same
        // moment. A board that has gone missing skips the zip and still gets
        // the snapshot — the file-level copy needs no board at all.
        const board = (await boardsRepo.listBoards(db)).find((b) => b.id === boardId);
        if (board) await writeDailyBackup(db, board.id, board.name);

        await settingsRepo.setSetting(db, LAST_SNAPSHOT_SEQ, String(seq));
        await settingsRepo.setSetting(db, LAST_SNAPSHOT_AT, new Date().toISOString());
      } catch (e) {
        // Insurance, not a precondition — a failed snapshot must never stop
        // the app backgrounding.
        console.warn('[autoSnapshot] failed', e);
      } finally {
        running.current = false;
      }
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') void maybeSnapshot();
    });
    return () => sub.remove();
  }, [boardId]);
}
