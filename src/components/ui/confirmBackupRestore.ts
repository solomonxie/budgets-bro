import { Alert } from 'react-native';
import { parseBackupZip } from '../../sync/parseBackupZip';
import type { PickedAppExport } from '../../sync/parseBackupZip';
import { summarizeBackup } from '../../sync/backupSummary';
import type { BackupSummary } from '../../sync/backupSummary';
import type { TranslationKey } from '../../i18n';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

function formatDay(iso: string, locale: string): string {
  const day = iso.length === 10 ? `${iso}T00:00:00` : iso;
  return new Date(day).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function backupSummaryText(t: T, summary: BackupSummary, locale: string): string {
  const count = (n: number) => n.toLocaleString(locale);
  return [
    summary.boardName && summary.exportedAt
      ? t('backupSummary.board', {
          name: summary.boardName,
          date: formatDay(summary.exportedAt, locale),
        })
      : null,
    t('backupSummary.counts', {
      accounts: count(summary.accounts),
      categories: count(summary.categories),
      transactions: count(summary.transactions),
    }),
    summary.firstDate && summary.lastDate
      ? t('backupSummary.span', {
          from: formatDay(summary.firstDate, locale),
          to: formatDay(summary.lastDate, locale),
        })
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

// Reads the file before asking, so the question can say what is in it —
// two backups a week apart look identical by name. The bytes were going to
// be fetched for the restore anyway; this only moves the wait ahead of it.
export async function confirmBackupRestore({
  t,
  locale,
  name,
  load,
  setBusy,
  onError,
  onConfirmed,
}: {
  t: T;
  locale: string;
  name: string;
  load: () => Promise<Uint8Array | null | undefined>;
  setBusy: (busy: boolean) => void;
  onError: (message: string) => void;
  onConfirmed: (backup: PickedAppExport) => void;
}): Promise<void> {
  let backup: PickedAppExport;
  setBusy(true);
  try {
    const bytes = await load();
    if (!bytes) throw new Error(t('s3Browser.restoreNotFound'));
    backup = await parseBackupZip(bytes);
  } catch (e) {
    onError(e instanceof Error ? e.message : t('settings.restoreFailed'));
    return;
  } finally {
    setBusy(false);
  }
  Alert.alert(
    t('s3Browser.restoreConfirmTitle', { name }),
    `${backupSummaryText(t, summarizeBackup(backup), locale)}\n\n${t('s3Browser.restoreConfirmMessage')}`,
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('backup.restore'), onPress: () => onConfirmed(backup) },
    ],
  );
}
