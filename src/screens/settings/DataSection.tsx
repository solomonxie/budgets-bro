import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ResultToast } from '../../components/ui/ResultToast';
import { getDb } from '../../db/client';
import { exportBoardZip } from '../../export/exportBoard';
import { pickYnabExport } from '../../import/pickYnabExport';
import { importYnabExport } from '../../import/ynabImporter';
import { restoreCategoriesFromYnab } from '../../import/restoreCategoriesFromYnab';
import type { CategoryRestoreResult } from '../../import/restoreCategoriesFromYnab';
import type { YnabImportResult } from '../../import/ynabImporter';
import { pickAppExport } from '../../import/pickAppExport';
import { writeOperationBackup } from '../../backup/localBackup';
import { purgeAllBackups } from '../../backup/purgeBackups';
import type { PurgeResult } from '../../backup/purgeBackups';
import { importAppExport } from '../../import/appExportImporter';
import type { AppExportImportResult } from '../../import/appExportImporter';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Action = 'export' | 'importBackup' | 'importYnab' | 'restoreCategories' | 'purge';

interface DataSectionProps {
  boardId: number;
  boardName: string;
  onImported: () => void;
  onRestored: (summary: AppExportImportResult) => void;
}

// Three text links under the backup destinations, not three rows with
// headings, hints and result tables. Each one is a one-off that opens a
// picker or a share sheet and then is over — the labels already say what
// they do, and anything more turned a three-item list into half a screen.
export function DataSection({ boardId, boardName, onImported, onRestored }: DataSectionProps) {
  const t = useT();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ynabResult, setYnabResult] = useState<YnabImportResult | null>(null);
  const [restoreResult, setRestoreResult] = useState<CategoryRestoreResult | null>(null);
  const [purgeResult, setPurgeResult] = useState<PurgeResult | null>(null);

  const runExport = async () => {
    setBusy('export');
    setError(null);
    try {
      const db = await getDb();
      await exportBoardZip(db, boardId, boardName || 'board');
    } catch (e) {
      Alert.alert(t('settings.exportFailedTitle'), e instanceof Error ? e.message : t('settings.exportFailedFallback'));
    } finally {
      setBusy(null);
    }
  };

  // Restores this app's own export as a brand-new board — never merged into
  // whichever board happens to be active.
  const runImportBackup = async () => {
    setError(null);
    try {
      const files = await pickAppExport();
      if (!files) return;
      setBusy('importBackup');
      const db = await getDb();
      // This and the two imports below rewrite many rows at once, and the
      // day's rolling backup may have captured the good state hours ago — or,
      // on a busy day, minutes ago and then been overwritten by the bad one.
      // So each writes its own file first, named after what it precedes and
      // kept apart from the daily overwrite (backup/localBackupName.ts).
      await writeOperationBackup(db, boardId, boardName, 'restore');
      onRestored(await importAppExport(db, files));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('settings.restoreFailed'));
    } finally {
      setBusy(null);
    }
  };

  const runImportYnab = async () => {
    setError(null);
    setYnabResult(null);
    try {
      const files = await pickYnabExport();
      if (!files) return;
      setBusy('importYnab');
      const db = await getDb();
      await writeOperationBackup(db, boardId, boardName, 'ynab-import');
      setYnabResult(await importYnabExport(db, boardId, files));
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('settings.importFailed'));
    } finally {
      setBusy(null);
    }
  };

  // Repairs categories from the same export without re-importing it —
  // re-importing upserts, which would bring back transactions deleted since
  // and overwrite edits. This only fills in a category where there is none.
  const runRestoreCategories = async () => {
    setError(null);
    setRestoreResult(null);
    try {
      const files = await pickYnabExport();
      if (!files) return;
      setBusy('restoreCategories');
      const db = await getDb();
      await writeOperationBackup(db, boardId, boardName, 'category-repair');
      setRestoreResult(await restoreCategoriesFromYnab(db, boardId, files.registerCsv));
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('settings.importFailed'));
    } finally {
      setBusy(null);
    }
  };

  // Destructive, and irreversible in the one way that matters: it deletes the
  // copies, so there is nothing to undo it with. Hence the confirm, and the
  // wording that separates backups from data — this removes neither the
  // database nor the change log.
  const runPurge = () => {
    Alert.alert(t('settings.purgeBackupsTitle'), t('settings.purgeBackupsMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.purgeBackupsConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy('purge');
          setError(null);
          try {
            setPurgeResult(await purgeAllBackups(await getDb()));
          } catch (e) {
            setError(e instanceof Error ? e.message : t('settings.purgeBackupsFailed'));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const links: { action: Action; label: string; onPress: () => void }[] = [
    { action: 'export', label: t('settings.exportBoard'), onPress: runExport },
    { action: 'importBackup', label: t('settings.importAppBackup'), onPress: runImportBackup },
    { action: 'importYnab', label: t('settings.importYnab'), onPress: runImportYnab },
    { action: 'restoreCategories', label: t('settings.restoreCategories'), onPress: runRestoreCategories },
    { action: 'purge', label: t('settings.purgeBackups'), onPress: runPurge },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.links}>
        {links.map((link) => (
          <Pressable key={link.action} onPress={link.onPress} disabled={busy != null} hitSlop={8}>
            {busy === link.action ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={[styles.linkText, busy != null && styles.linkTextDisabled]}>{link.label}</Text>
            )}
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <ResultToast
        visible={ynabResult != null}
        title={t('settings.importedHeading')}
        lines={
          ynabResult
            ? [
                { label: t('settings.importResultTxnInserted'), value: String(ynabResult.transactionsInserted) },
                { label: t('settings.importResultTxnUpdated'), value: String(ynabResult.transactionsUpdated) },
                { label: t('settings.importResultBudgetWritten'), value: String(ynabResult.budgetEntriesWritten) },
                { label: t('settings.importResultAccountsCreated'), value: String(ynabResult.accountsCreated) },
                { label: t('settings.importResultCategoriesCreated'), value: String(ynabResult.categoriesCreated) },
              ]
            : []
        }
        onDismiss={() => setYnabResult(null)}
      />
      <ResultToast
        visible={restoreResult != null}
        title={t('settings.restoreCategoriesHeading')}
        lines={
          restoreResult
            ? [
                { label: t('settings.restoreResultRestored'), value: String(restoreResult.restored) },
                { label: t('settings.restoreResultAlreadySet'), value: String(restoreResult.alreadySet) },
                { label: t('settings.restoreResultNotFound'), value: String(restoreResult.notFound) },
                { label: t('settings.restoreResultCategoryMissing'), value: String(restoreResult.categoryMissing) },
              ]
            : []
        }
        onDismiss={() => setRestoreResult(null)}
      />
      <ResultToast
        visible={purgeResult != null}
        title={t('settings.purgeBackupsHeading')}
        lines={
          purgeResult
            ? [
                { label: t('settings.purgeResultLocal'), value: String(purgeResult.localZips) },
                { label: t('settings.purgeResultSnapshots'), value: String(purgeResult.snapshots) },
                { label: t('settings.purgeResultICloud'), value: String(purgeResult.icloud) },
                { label: t('settings.purgeResultBucket'), value: String(purgeResult.bucket) },
                ...(purgeResult.bucketRefused > 0
                  ? [{ label: t('settings.purgeResultRefused'), value: String(purgeResult.bucketRefused) }]
                  : []),
              ]
            : []
        }
        onDismiss={() => setPurgeResult(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs, marginBottom: spacing.md },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  linkText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  linkTextDisabled: { opacity: 0.4 },
  errorText: { color: colors.negative, fontSize: 13, textAlign: 'center' },
});
