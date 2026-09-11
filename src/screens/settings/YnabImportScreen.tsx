import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { getDb } from '../../db/client';
import { pickYnabExport } from '../../import/pickYnabExport';
import { importYnabExport } from '../../import/ynabImporter';
import type { YnabImportResult } from '../../import/ynabImporter';
import { useBoards } from '../../hooks/useBoards';
import { useAppStore } from '../../state/useAppStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function YnabImportScreen() {
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const { boards } = useBoards();
  const activeBoardName = boards.find((b) => b.id === boardId)?.name ?? '…';
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<YnabImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setResult(null);
    try {
      const files = await pickYnabExport();
      if (!files) return;
      setBusy(true);
      const db = await getDb();
      const summary = await importYnabExport(db, boardId, files);
      setResult(summary);
      bumpDataVersion();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.card}>
        <Text style={styles.title}>Import from YNAB</Text>
        <Text style={styles.boardNote}>Importing into board: {activeBoardName}. Switch boards in Settings first if needed.</Text>
        <Text style={styles.body}>
          Pick the .zip you downloaded from YNAB&rsquo;s &ldquo;Export Budget&rdquo; — it contains a Register and a
          Plan CSV. Accounts, categories, and payees are matched by name (or created); it&rsquo;s safe to import the
          same export more than once — re-running it updates existing transactions instead of duplicating them.
        </Text>
        <Pressable style={styles.button} onPress={run} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Choose Export File…</Text>}
        </Pressable>
      </View>

      {error ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {result ? (
        <View style={styles.card}>
          <Text style={styles.title}>Import complete</Text>
          <Row label="Transactions imported" value={result.transactionsInserted} />
          <Row label="Transactions updated" value={result.transactionsUpdated} />
          <Row label="Budgeted amounts written" value={result.budgetEntriesWritten} />
          <Row label="Accounts created" value={result.accountsCreated} />
          <Row label="Categories created" value={result.categoriesCreated} />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  boardNote: { fontSize: 12, fontWeight: '600', color: colors.accent },
  button: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorText: { color: colors.negative, fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { fontSize: 14, color: colors.text },
  rowValue: { fontSize: 14, fontWeight: '700', color: colors.text },
});
