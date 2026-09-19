import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ResultToast } from '../../components/ui/ResultToast';
import { getDb } from '../../db/client';
import { exportBoardZip } from '../../export/exportBoard';
import { pickYnabExport } from '../../import/pickYnabExport';
import { importYnabExport } from '../../import/ynabImporter';
import type { YnabImportResult } from '../../import/ynabImporter';
import { pickAppExport } from '../../import/pickAppExport';
import { writeOperationBackup } from '../../backup/localBackup';
import { importAppExport } from '../../import/appExportImporter';
import type { AppExportImportResult } from '../../import/appExportImporter';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Action = 'export' | 'importBackup' | 'importYnab';

interface DataSectionProps {
  boardId: number;
  boardName: string;
  onImported: () => void;
  onRestored: (summary: AppExportImportResult) => void;
  // Rows owned by another component that belong in this same list — the
  // change log opens its own sheet, but to the user it is one more thing you
  // can do to this board's data.
  children?: ReactNode;
}

// A list of rows in one card, like every other section on this page. These
// used to be centre-aligned teal links that wrapped into a ragged block: six
// actions of wildly different weight — export, import, repair, and one that
// deletes every backup you have — all rendered identically and re-flowing
// into different lines as the labels changed length. A row per action reads
// top to bottom, keeps the destructive one at the bottom in red where the
// platform puts it, and leaves room to say what each one does.
export function DataSection({
  boardId,
  boardName,
  onImported,
  onRestored,
  children,
}: DataSectionProps) {
  const t = useT();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ynabResult, setYnabResult] = useState<YnabImportResult | null>(null);

  const runExport = async () => {
    setBusy('export');
    setError(null);
    try {
      const db = await getDb();
      await exportBoardZip(db, boardId, boardName || 'board');
    } catch (e) {
      Alert.alert(
        t('settings.exportFailedTitle'),
        e instanceof Error ? e.message : t('settings.exportFailedFallback'),
      );
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

  const rows: {
    action: Action;
    label: string;
    hint: string;
    onPress: () => void;
  }[] = [
    {
      action: 'export',
      label: t('settings.exportBoard'),
      hint: t('settings.exportBoardHint'),
      onPress: runExport,
    },
    {
      action: 'importBackup',
      label: t('settings.importAppBackup'),
      hint: t('settings.importAppBackupHint'),
      onPress: runImportBackup,
    },
    {
      action: 'importYnab',
      label: t('settings.importYnab'),
      hint: t('settings.importYnabHint'),
      onPress: runImportYnab,
    },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('settings.dataHeading')}</Text>
      <View style={styles.group}>
        {rows.map((row, i) => (
          <Pressable
            key={row.action}
            style={[styles.row, i > 0 && styles.rowDivider]}
            onPress={row.onPress}
            disabled={busy != null}
          >
            <View style={styles.rowMain}>
              <Text style={[styles.rowLabel, busy != null && styles.dimmed]}>
                {row.label}
              </Text>
              <Text style={styles.rowHint}>{row.hint}</Text>
            </View>
            {busy === row.action ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </Pressable>
        ))}
        {children}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <ResultToast
        visible={ynabResult != null}
        title={t('settings.importedHeading')}
        lines={
          ynabResult
            ? [
                {
                  label: t('settings.importResultTxnInserted'),
                  value: String(ynabResult.transactionsInserted),
                },
                {
                  label: t('settings.importResultTxnUpdated'),
                  value: String(ynabResult.transactionsUpdated),
                },
                {
                  label: t('settings.importResultBudgetWritten'),
                  value: String(ynabResult.budgetEntriesWritten),
                },
                {
                  label: t('settings.importResultAccountsCreated'),
                  value: String(ynabResult.accountsCreated),
                },
                {
                  label: t('settings.importResultCategoriesCreated'),
                  value: String(ynabResult.categoriesCreated),
                },
              ]
            : []
        }
        onDismiss={() => setYnabResult(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs, marginBottom: spacing.md },
  heading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowMain: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowHint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  destructive: { color: colors.negative },
  dimmed: { opacity: 0.4 },
  chevron: { fontSize: 18, color: colors.textMuted },
  errorText: { color: colors.negative, fontSize: 13 },
});
