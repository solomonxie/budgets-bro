import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import { RowMenuButton } from '../../components/ui/RowMenuButton';
import { PromptModal } from '../../components/ui/PromptModal';
import { SearchableDropdownField } from '../../components/ui/SearchableDropdownField';
import { useBoards } from '../../hooks/useBoards';
import { usePayees } from '../../hooks/usePayees';
import { getDb } from '../../db/client';
import * as settingsRepo from '../../db/repositories/settingsRepo';
import * as payeesRepo from '../../db/repositories/payeesRepo';
import { secureStore } from '../../secure/secureStore';
import { exportBoardZip } from '../../export/exportBoard';
import { pickYnabExport } from '../../import/pickYnabExport';
import { importYnabExport } from '../../import/ynabImporter';
import type { YnabImportResult } from '../../import/ynabImporter';
import { pickAppExport } from '../../import/pickAppExport';
import { importAppExport } from '../../import/appExportImporter';
import type { AppExportImportResult } from '../../import/appExportImporter';
import { useAppStore } from '../../state/useAppStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const THEME_KEY = 'theme_preference';
type ThemePreference = 'dark' | 'light';

type PromptState =
  | { type: 'newBoard' }
  | { type: 'renameBoard'; boardId: number; initial: string }
  | { type: 'renamePayee'; payeeId: number; initial: string }
  | null;

export function SettingsScreen() {
  const { boards, currentBoardId, switchBoard, addBoard, renameBoard, removeBoard } = useBoards();
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const { payees, refresh: refreshPayees } = usePayees();
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [selectedPayeeId, setSelectedPayeeId] = useState<number | null>(null);
  const [payeeNameInput, setPayeeNameInput] = useState('');

  const [theme, setTheme] = useState<ThemePreference>('dark');
  const [aiApiKey, setAiApiKey] = useState('');
  const [s3AccessKeyId, setS3AccessKeyId] = useState('');
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<YnabImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<AppExportImportResult | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const savedTheme = await settingsRepo.getSetting(db, THEME_KEY);
      if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme);
      setAiApiKey((await secureStore.getAiApiKey()) ?? '');
      const s3 = await secureStore.getS3Credentials();
      setS3AccessKeyId(s3?.accessKeyId ?? '');
      setS3SecretAccessKey(s3?.secretAccessKey ?? '');
    })();
  }, []);

  const selectTheme = async (next: ThemePreference) => {
    setTheme(next);
    const db = await getDb();
    await settingsRepo.setSetting(db, THEME_KEY, next);
  };

  const saveAiApiKey = async () => {
    if (aiApiKey.trim()) await secureStore.setAiApiKey(aiApiKey.trim());
    else await secureStore.clearAiApiKey();
  };

  const saveS3Credentials = async () => {
    if (s3AccessKeyId.trim() && s3SecretAccessKey.trim()) {
      await secureStore.setS3Credentials(s3AccessKeyId.trim(), s3SecretAccessKey.trim());
    } else {
      await secureStore.clearS3Credentials();
    }
  };

  const runImport = async () => {
    setImportError(null);
    setImportResult(null);
    try {
      const files = await pickYnabExport();
      if (!files) return;
      setImporting(true);
      const db = await getDb();
      const summary = await importYnabExport(db, boardId, files);
      setImportResult(summary);
      bumpDataVersion();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  // Restores this app's own export as a brand-new board and switches to it
  // — never merged into the currently active board.
  const runRestore = async () => {
    setRestoreError(null);
    setRestoreResult(null);
    try {
      const files = await pickAppExport();
      if (!files) return;
      setRestoring(true);
      const db = await getDb();
      const summary = await importAppExport(db, files);
      setRestoreResult(summary);
      bumpDataVersion();
      await switchBoard(summary.boardId);
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : 'Restore failed.');
    } finally {
      setRestoring(false);
    }
  };

  const runExport = async () => {
    setExporting(true);
    try {
      const db = await getDb();
      const board = boards.find((b) => b.id === boardId);
      await exportBoardZip(db, boardId, board?.name ?? 'board');
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  };

  const submitPrompt = async (value: string) => {
    if (prompt?.type === 'newBoard') {
      const id = await addBoard(value);
      await switchBoard(id);
    } else if (prompt?.type === 'renameBoard') {
      await renameBoard(prompt.boardId, value);
    } else if (prompt?.type === 'renamePayee') {
      const db = await getDb();
      await payeesRepo.renamePayee(db, prompt.payeeId, value);
      setPayeeNameInput(value);
      refreshPayees();
    }
    setPrompt(null);
  };

  const selectedPayee = payees.find((p) => p.id === selectedPayeeId) ?? null;

  const selectPayee = (id: number, name: string) => {
    setSelectedPayeeId(id);
    setPayeeNameInput(name);
  };

  const createPayee = async (name: string) => {
    const db = await getDb();
    const id = await payeesRepo.findOrCreatePayee(db, boardId, name);
    refreshPayees();
    if (id != null) selectPayee(id, name.trim());
  };

  const deleteSelectedPayee = () => {
    if (selectedPayeeId == null) return;
    Alert.alert(`Delete "${payeeNameInput}"?`, 'Past transactions keep their amounts but lose this payee. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await payeesRepo.deletePayee(db, selectedPayeeId);
          setSelectedPayeeId(null);
          setPayeeNameInput('');
          refreshPayees();
          bumpDataVersion();
        },
      },
    ]);
  };

  const confirmDeleteBoard = (id: number, name: string) => {
    if (boards.length <= 1) {
      Alert.alert('Can’t delete your only board', 'Create another board first.');
      return;
    }
    Alert.alert(`Delete "${name}"?`, 'Every account, category, and transaction in it is deleted too. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeBoard(id) },
    ]);
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Budget Boards</Text>
        <Text style={styles.sectionHint}>
          A board is a self-contained budget — its own accounts, categories, and transactions. Switch boards to
          keep separate budgets (e.g. personal vs. a shared one) in one app.
        </Text>
        <View style={styles.group}>
          {boards.map((board) => (
            <Pressable key={board.id} style={styles.row} onPress={() => switchBoard(board.id)}>
              <View style={styles.boardRowMain}>
                <View style={[styles.radio, board.id === currentBoardId && styles.radioActive]} />
                <Text style={styles.rowTitle}>{board.name}</Text>
              </View>
              <RowMenuButton
                items={[
                  { label: 'Rename', onPress: () => setPrompt({ type: 'renameBoard', boardId: board.id, initial: board.name }) },
                  { label: 'Delete', destructive: true, onPress: () => confirmDeleteBoard(board.id, board.name) },
                ]}
              />
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.addLink} onPress={() => setPrompt({ type: 'newBoard' })}>
          <Text style={styles.addLinkText}>+ New Board</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Payees</Text>
        <Text style={styles.sectionHint}>Pick a payee to rename or delete it, or type a new name to create one.</Text>
        <SearchableDropdownField
          label="Payee"
          valueLabel={payeeNameInput}
          placeholder="Select or create…"
          searchPlaceholder="Search or type a new payee"
          options={payees.map((p) => ({ id: p.id, label: p.linkedAccountId != null ? `${p.name} (account)` : p.name }))}
          onSelect={(o) => selectPayee(o.id, o.label.replace(/ \(account\)$/, ''))}
          onUseText={createPayee}
        />
        {selectedPayee != null ? (
          selectedPayee.linkedAccountId != null ? (
            <Text style={styles.sectionHint}>Linked to an account — managed automatically, can&rsquo;t be renamed or deleted here.</Text>
          ) : (
            <View style={styles.payeeActions}>
              <Pressable
                style={styles.payeeActionButton}
                onPress={() => setPrompt({ type: 'renamePayee', payeeId: selectedPayee.id, initial: payeeNameInput })}
              >
                <Text style={styles.payeeActionText}>Rename</Text>
              </Pressable>
              <Pressable style={styles.payeeActionButton} onPress={deleteSelectedPayee}>
                <Text style={[styles.payeeActionText, styles.deletePayeeText]}>Delete</Text>
              </Pressable>
            </View>
          )
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Appearance</Text>
        <View style={styles.segmented}>
          {(['dark', 'light'] as const).map((opt) => (
            <Pressable key={opt} style={[styles.segment, theme === opt && styles.segmentActive]} onPress={() => selectTheme(opt)}>
              <Text style={[styles.segmentText, theme === opt && styles.segmentTextActive]}>
                {opt === 'dark' ? 'Dark' : 'Light'}
              </Text>
            </Pressable>
          ))}
        </View>
        {theme === 'light' ? (
          <Text style={styles.sectionHint}>Light theme is coming soon — your preference is saved for when it ships.</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>OpenAI</Text>
        <Text style={styles.sectionHint}>
          Used by AI Analysis. Sent straight from this device to OpenAI when you run an analysis — never stored or
          seen by us. The key itself never leaves this device, including in backups.
        </Text>
        <TextField
          placeholder="sk-..."
          value={aiApiKey}
          onChangeText={setAiApiKey}
          onBlur={saveAiApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>AWS S3</Text>
        <Text style={styles.sectionHint}>
          Used only for backups you trigger. The key itself never leaves this device, including in backups — only
          your board&rsquo;s money data goes to S3, and only when you back up.
        </Text>
        <TextField
          label="Access Key ID"
          value={s3AccessKeyId}
          onChangeText={setS3AccessKeyId}
          onBlur={saveS3Credentials}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField
          label="Secret Access Key"
          value={s3SecretAccessKey}
          onChangeText={setS3SecretAccessKey}
          onBlur={saveS3Credentials}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Data</Text>
        <Pressable style={styles.importButton} onPress={runImport} disabled={importing}>
          {importing ? <ActivityIndicator /> : <Text style={styles.importButtonText}>Import from YNAB…</Text>}
        </Pressable>
        {importError ? <Text style={styles.errorText}>{importError}</Text> : null}
        {importResult ? (
          <View style={styles.group}>
            <ImportResultRow label="Transactions imported" value={importResult.transactionsInserted} />
            <ImportResultRow label="Transactions updated" value={importResult.transactionsUpdated} />
            <ImportResultRow label="Budgeted amounts written" value={importResult.budgetEntriesWritten} />
            <ImportResultRow label="Accounts created" value={importResult.accountsCreated} />
            <ImportResultRow label="Categories created" value={importResult.categoriesCreated} />
          </View>
        ) : null}
        <Pressable style={styles.importButton} onPress={runRestore} disabled={restoring}>
          {restoring ? <ActivityIndicator /> : <Text style={styles.importButtonText}>Import App Backup…</Text>}
        </Pressable>
        <Text style={styles.sectionHint}>Pick a .zip from this app's own "Export Board as .zip" — restores it as a new board.</Text>
        {restoreError ? <Text style={styles.errorText}>{restoreError}</Text> : null}
        {restoreResult ? (
          <View style={styles.group}>
            <ImportResultRow label="Restored into board" value={restoreResult.boardName} />
            <ImportResultRow label="Accounts" value={restoreResult.accountsImported} />
            <ImportResultRow label="Categories" value={restoreResult.categoriesImported} />
            <ImportResultRow label="Transactions" value={restoreResult.transactionsImported} />
          </View>
        ) : null}
        <Pressable style={styles.exportButton} onPress={runExport} disabled={exporting}>
          {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.exportButtonText}>Export Board as .zip</Text>}
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>About</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Version</Text>
            <Text style={styles.rowValue}>1.0.0 (MVP)</Text>
          </View>
        </View>
      </View>

      <PromptModal
        visible={prompt != null}
        title={prompt?.type === 'newBoard' ? 'New Board' : prompt?.type === 'renamePayee' ? 'Rename Payee' : 'Rename Board'}
        placeholder={prompt?.type === 'renamePayee' ? 'Payee name' : 'e.g. Personal Budget'}
        initialValue={prompt && 'initial' in prompt ? prompt.initial : ''}
        onCancel={() => setPrompt(null)}
        onSubmit={submitPrompt}
      />
    </ScreenContainer>
  );
}

function ImportResultRow({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs, marginBottom: spacing.md },
  sectionHeading: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  sectionHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  group: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  boardRowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  radio: { width: 16, height: 16, borderRadius: 999, borderWidth: 2, borderColor: colors.border },
  radioActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  rowTitle: { fontSize: 15, color: colors.text },
  rowValue: { fontSize: 13, color: colors.textMuted },
  addLink: { alignItems: 'center', paddingVertical: spacing.sm },
  addLinkText: { color: colors.accent, fontWeight: '700' },
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
  payeeActions: { flexDirection: 'row', gap: spacing.sm },
  payeeActionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  payeeActionText: { fontWeight: '600', fontSize: 14, color: colors.text },
  deletePayeeText: { color: colors.negative },
  errorText: { color: colors.negative, fontSize: 13 },
  importButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  importButtonText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  exportButton: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  exportButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
