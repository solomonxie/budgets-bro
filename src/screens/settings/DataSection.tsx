import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../../db/client';
import { exportBoardZip } from '../../export/exportBoard';
import { pickYnabExport } from '../../import/pickYnabExport';
import { importYnabExport } from '../../import/ynabImporter';
import type { YnabImportResult } from '../../import/ynabImporter';
import { pickAppExport } from '../../import/pickAppExport';
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
}

// Three chevron rows in one group, not three full-width buttons stacked with
// their hints and result tables between them. They're peers — none of them is
// the primary action of this screen — and as buttons they read as three
// competing calls to action in a section that's really just a list.
export function DataSection({ boardId, boardName, onImported, onRestored }: DataSectionProps) {
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
      setYnabResult(await importYnabExport(db, boardId, files));
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('settings.importFailed'));
    } finally {
      setBusy(null);
    }
  };

  const rows: { action: Action; title: string; subtitle: string; onPress: () => void }[] = [
    { action: 'export', title: t('settings.exportBoard'), subtitle: t('data.exportHint'), onPress: runExport },
    { action: 'importBackup', title: t('settings.importAppBackup'), subtitle: t('settings.importAppBackupHint'), onPress: runImportBackup },
    { action: 'importYnab', title: t('settings.importYnab'), subtitle: t('data.importYnabHint'), onPress: runImportYnab },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading}>{t('settings.dataHeading')}</Text>
      <View style={styles.group}>
        {rows.map((row, i) => (
          <Pressable key={row.action} style={[styles.row, i > 0 && styles.rowDivider]} onPress={row.onPress} disabled={busy != null}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
            </View>
            {busy === row.action ? <ActivityIndicator /> : <Text style={styles.chevron}>›</Text>}
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {ynabResult ? (
        <View style={styles.group}>
          <ResultRow label={t('settings.importResultTxnInserted')} value={ynabResult.transactionsInserted} />
          <ResultRow label={t('settings.importResultTxnUpdated')} value={ynabResult.transactionsUpdated} />
          <ResultRow label={t('settings.importResultBudgetWritten')} value={ynabResult.budgetEntriesWritten} />
          <ResultRow label={t('settings.importResultAccountsCreated')} value={ynabResult.accountsCreated} />
          <ResultRow label={t('settings.importResultCategoriesCreated')} value={ynabResult.categoriesCreated} />
        </View>
      ) : null}
    </View>
  );
}

function ResultRow({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.rowTitle}>{label}</Text>
      <Text style={styles.rowSubtitle}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs, marginBottom: spacing.md },
  sectionHeading: {
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12, paddingHorizontal: spacing.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, color: colors.text },
  rowSubtitle: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  chevron: { fontSize: 18, color: colors.textMuted },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  errorText: { color: colors.negative, fontSize: 13 },
});
