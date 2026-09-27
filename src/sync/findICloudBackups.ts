import ICloudDrive from '../../modules/icloud-drive';
import { latestKeyPerBoard } from './backupPath';
import { parseBackupZip } from './parseBackupZip';
import type { PickedAppExport } from './parseBackupZip';
import { summarizeBackup } from './backupSummary';
import type { BackupSummary } from './backupSummary';

export interface FoundBoardBackup {
  key: string;
  backup: PickedAppExport;
  summary: BackupSummary;
}

// What a reinstall can bring back from iCloud Drive: the newest automatic
// backup of each board, newest first. A renamed board leaves older files
// under its old name; the manifest's board id says they are the same board,
// and only the newest is offered.
export async function findICloudBoardBackups(): Promise<FoundBoardBackup[]> {
  if (!ICloudDrive || (await ICloudDrive.getStatus()) !== 'available') return [];
  const found: FoundBoardBackup[] = [];
  for (const key of latestKeyPerBoard(await ICloudDrive.list())) {
    try {
      const bytes = await ICloudDrive.read(key);
      if (!bytes) continue;
      const backup = await parseBackupZip(bytes);
      found.push({ key, backup, summary: summarizeBackup(backup) });
    } catch (e) {
      console.warn('[findICloudBackups] unreadable', key, e);
    }
  }
  const byBoard = new Map<string, FoundBoardBackup>();
  for (const f of found) {
    const id = f.backup.manifest ? String(f.backup.manifest.boardId) : f.key;
    const current = byBoard.get(id);
    if (!current || (f.summary.exportedAt ?? '') > (current.summary.exportedAt ?? '')) byBoard.set(id, f);
  }
  return [...byBoard.values()].sort((a, b) => ((a.summary.exportedAt ?? '') < (b.summary.exportedAt ?? '') ? 1 : -1));
}
