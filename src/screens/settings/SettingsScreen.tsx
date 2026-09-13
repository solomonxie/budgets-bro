import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import { RowMenuButton } from '../../components/ui/RowMenuButton';
import { PromptModal } from '../../components/ui/PromptModal';
import { SearchableDropdownField } from '../../components/ui/SearchableDropdownField';
import { DropdownField } from '../../components/ui/DropdownField';
import { useBoards } from '../../hooks/useBoards';
import { usePayees } from '../../hooks/usePayees';
import { useLanguageSetting } from '../../hooks/useLanguage';
import { getDb } from '../../db/client';
import * as settingsRepo from '../../db/repositories/settingsRepo';
import * as payeesRepo from '../../db/repositories/payeesRepo';
import { secureStore } from '../../secure/secureStore';
import { listS3Configs, addS3Config, removeS3Config } from '../../sync/s3Provider';
import type { S3ConfigMeta, S3ConfigInput } from '../../sync/s3Provider';
import { S3ConfigModal } from '../../components/ui/S3ConfigModal';
import { S3BrowserModal } from '../../components/ui/S3BrowserModal';
import { isLocalBackupEnabled, setLocalBackupEnabled } from '../../sync/localProvider';
import {
  syncNow,
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  getLastSyncedSummary,
  downloadLatestBackup,
  hasAnyProviderConfigured,
} from '../../sync/cloudSync';
import { parseBackupZip } from '../../sync/parseBackupZip';
import { exportBoardZip } from '../../export/exportBoard';
import { pickYnabExport } from '../../import/pickYnabExport';
import { importYnabExport } from '../../import/ynabImporter';
import type { YnabImportResult } from '../../import/ynabImporter';
import { pickAppExport } from '../../import/pickAppExport';
import { importAppExport } from '../../import/appExportImporter';
import type { AppExportImportResult } from '../../import/appExportImporter';
import { seedDemoBoard } from '../../db/seed/demoBoard';
import { useAppStore } from '../../state/useAppStore';
import { useT, LANGUAGES } from '../../i18n';
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
  const t = useT();
  const { language, selectLanguage } = useLanguageSetting();
  const { boards, currentBoardId, switchBoard, addBoard, renameBoard, removeBoard } = useBoards();
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const { payees, refresh: refreshPayees } = usePayees();
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [selectedPayeeId, setSelectedPayeeId] = useState<number | null>(null);
  const [payeeNameInput, setPayeeNameInput] = useState('');

  const [theme, setTheme] = useState<ThemePreference>('dark');
  const [aiApiKey, setAiApiKey] = useState('');
  const [s3Configs, setS3Configs] = useState<S3ConfigMeta[]>([]);
  const [s3ModalOpen, setS3ModalOpen] = useState(false);
  const [browsingS3Config, setBrowsingS3Config] = useState<S3ConfigMeta | null>(null);
  const [localBackupOn, setLocalBackupOn] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [lastSyncedAt, setLastSyncedAtState] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [restoringFromCloud, setRestoringFromCloud] = useState(false);
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
      setS3Configs(await listS3Configs(db));
      setLocalBackupOn(await isLocalBackupEnabled(db));
      setAutoSync(await isAutoSyncEnabled(db));
      setLastSyncedAtState(await getLastSyncedSummary(db));
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

  const addS3Backup = async (input: S3ConfigInput) => {
    const db = await getDb();
    await addS3Config(db, input);
    setS3Configs(await listS3Configs(db));
    setS3ModalOpen(false);
  };

  const confirmRemoveS3Config = (config: S3ConfigMeta) => {
    Alert.alert(t('settings.deleteS3ConfigConfirmTitle', { name: config.bucket }), t('settings.deleteS3ConfigConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await removeS3Config(db, config.id);
          setS3Configs(await listS3Configs(db));
        },
      },
    ]);
  };

  const toggleLocalBackup = async (value: boolean) => {
    setLocalBackupOn(value);
    const db = await getDb();
    await setLocalBackupEnabled(db, value);
  };

  const toggleAutoSync = async (value: boolean) => {
    setAutoSync(value);
    const db = await getDb();
    await setAutoSyncEnabled(db, value);
  };

  const runSyncNow = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const db = await getDb();
      const board = boards.find((b) => b.id === boardId);
      if (!board) return;
      // syncNow() itself skips silently when nothing is configured (correct
      // for the debounced auto-sync path) — but a manual button press with
      // no feedback at all looks indistinguishable from a hung sync, so
      // check here instead of leaving the user guessing.
      if (!(await hasAnyProviderConfigured(db))) {
        setSyncError(t('settings.noProviderConfigured'));
        return;
      }
      await syncNow(db, boardId, board.name);
      setLastSyncedAtState(await getLastSyncedSummary(db));
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : t('settings.syncFailed'));
    } finally {
      setSyncing(false);
    }
  };

  // Same "always creates a new board" behavior as Import App Backup below —
  // this just fetches the bytes from cloud instead of a file picker.
  const runRestoreFromCloud = async () => {
    setRestoringFromCloud(true);
    setRestoreError(null);
    setRestoreResult(null);
    try {
      const db = await getDb();
      const bytes = await downloadLatestBackup(db, boardId);
      if (!bytes) {
        setRestoreError(t('settings.noCloudBackupFound'));
        return;
      }
      const files = await parseBackupZip(bytes);
      const summary = await importAppExport(db, files);
      setRestoreResult(summary);
      bumpDataVersion();
      await switchBoard(summary.boardId);
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : t('settings.restoreFailed'));
    } finally {
      setRestoringFromCloud(false);
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
      setImportError(e instanceof Error ? e.message : t('settings.importFailed'));
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
      setRestoreError(e instanceof Error ? e.message : t('settings.restoreFailed'));
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
      Alert.alert(t('settings.exportFailedTitle'), e instanceof Error ? e.message : t('settings.exportFailedFallback'));
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
    Alert.alert(
      t('settings.deletePayeeConfirmTitle', { name: payeeNameInput }),
      t('settings.deletePayeeConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
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
      ],
    );
  };

  // Always makes a fresh one — deleting the demo board doesn't bring it back
  // on its own (see useEnsureDemoBoard), so this is the only way back.
  const runCreateDemoBoard = async () => {
    const db = await getDb();
    const id = await seedDemoBoard(db);
    bumpDataVersion();
    await switchBoard(id);
  };

  const confirmDeleteBoard = (id: number, name: string) => {
    if (boards.length <= 1) {
      Alert.alert(t('settings.cantDeleteOnlyBoardTitle'), t('settings.cantDeleteOnlyBoardMessage'));
      return;
    }
    Alert.alert(t('settings.deleteBoardConfirmTitle', { name }), t('settings.deleteBoardConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => removeBoard(id) },
    ]);
  };

  return (
    <ScreenContainer scroll modal>
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>{t('settings.boardsHeading')}</Text>
        <Text style={styles.sectionHint}>{t('settings.boardsHint')}</Text>
        <DropdownField
          compact
          label={t('settings.boardsHeading')}
          valueLabel={boards.find((b) => b.id === currentBoardId)?.name ?? ''}
        >
          {(close) => (
            <>
              {boards.map((board) => (
                <View key={board.id} style={styles.boardOptionRow}>
                  <Pressable
                    style={styles.boardOptionMain}
                    onPress={() => {
                      switchBoard(board.id);
                      close();
                    }}
                  >
                    <View style={[styles.radio, board.id === currentBoardId && styles.radioActive]} />
                    <Text style={styles.rowTitle}>{board.name}</Text>
                  </Pressable>
                  <RowMenuButton
                    items={[
                      {
                        label: t('common.rename'),
                        onPress: () => {
                          close();
                          setPrompt({ type: 'renameBoard', boardId: board.id, initial: board.name });
                        },
                      },
                      { label: t('settings.createDemoBoard'), onPress: () => { close(); runCreateDemoBoard(); } },
                      {
                        label: t('common.delete'),
                        destructive: true,
                        onPress: () => {
                          close();
                          confirmDeleteBoard(board.id, board.name);
                        },
                      },
                    ]}
                  />
                </View>
              ))}
              <Pressable
                style={styles.addLink}
                onPress={() => {
                  close();
                  setPrompt({ type: 'newBoard' });
                }}
              >
                <Text style={styles.addLinkText}>{t('settings.newBoardLink')}</Text>
              </Pressable>
            </>
          )}
        </DropdownField>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>{t('settings.payeesHeading')}</Text>
        <SearchableDropdownField
          compact
          label={t('common.payee')}
          valueLabel={payeeNameInput}
          placeholder={t('settings.payeeSelectPlaceholder')}
          searchPlaceholder={t('settings.payeeSearchPlaceholder')}
          options={payees.map((p) => ({ id: p.id, label: p.linkedAccountId != null ? `${p.name} (account)` : p.name }))}
          onSelect={(o) => selectPayee(o.id, o.label.replace(/ \(account\)$/, ''))}
          onUseText={createPayee}
        />
        {selectedPayee != null ? (
          selectedPayee.linkedAccountId != null ? (
            <Text style={styles.sectionHint}>{t('settings.payeeLinkedHint')}</Text>
          ) : (
            <View style={styles.payeeActions}>
              <Pressable
                style={styles.payeeActionButton}
                onPress={() => setPrompt({ type: 'renamePayee', payeeId: selectedPayee.id, initial: payeeNameInput })}
              >
                <Text style={styles.payeeActionText}>{t('common.rename')}</Text>
              </Pressable>
              <Pressable style={styles.payeeActionButton} onPress={deleteSelectedPayee}>
                <Text style={[styles.payeeActionText, styles.deletePayeeText]}>{t('common.delete')}</Text>
              </Pressable>
            </View>
          )
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>{t('settings.appearanceHeading')}</Text>
        <View style={styles.segmented}>
          {(['dark', 'light'] as const).map((opt) => (
            <Pressable key={opt} style={[styles.segment, theme === opt && styles.segmentActive]} onPress={() => selectTheme(opt)}>
              <Text style={[styles.segmentText, theme === opt && styles.segmentTextActive]}>
                {opt === 'dark' ? t('settings.themeDark') : t('settings.themeLight')}
              </Text>
            </Pressable>
          ))}
        </View>
        {theme === 'light' ? <Text style={styles.sectionHint}>{t('settings.themeLightHint')}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>{t('settings.languageHeading')}</Text>
        <View style={styles.segmented}>
          {LANGUAGES.map((opt) => (
            <Pressable
              key={opt.code}
              style={[styles.segment, language === opt.code && styles.segmentActive]}
              onPress={() => selectLanguage(opt.code)}
            >
              <Text style={[styles.segmentText, language === opt.code && styles.segmentTextActive]}>{t(opt.labelKey)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>{t('settings.openaiHeading')}</Text>
        <Text style={styles.sectionHint}>{t('settings.openaiHint')}</Text>
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
        <Text style={styles.sectionHeading}>{t('settings.localBackupHeading')}</Text>
        <Text style={styles.sectionHint}>{t('settings.localBackupHint')}</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('settings.localBackupToggle')}</Text>
          <Switch value={localBackupOn} onValueChange={toggleLocalBackup} trackColor={{ true: colors.accent, false: colors.border }} />
        </View>
        {localBackupOn ? <Text style={styles.rowValue}>{t('settings.localBackupSavedNote')}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>{t('settings.syncHeading')}</Text>
        <Text style={styles.sectionHint}>{t('settings.syncHint')}</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('settings.autoSyncToggle')}</Text>
          <Switch value={autoSync} onValueChange={toggleAutoSync} trackColor={{ true: colors.accent, false: colors.border }} />
        </View>
        <Text style={styles.sectionHint}>
          {lastSyncedAt ? t('settings.lastSynced', { time: new Date(lastSyncedAt).toLocaleString() }) : t('settings.lastSyncedNever')}
        </Text>
        {syncError ? <Text style={styles.errorText}>{syncError}</Text> : null}
        <Pressable style={styles.importButton} onPress={runSyncNow} disabled={syncing}>
          {syncing ? <ActivityIndicator /> : <Text style={styles.importButtonText}>{t('settings.syncNow')}</Text>}
        </Pressable>
        <Pressable style={styles.importButton} onPress={runRestoreFromCloud} disabled={restoringFromCloud}>
          {restoringFromCloud ? <ActivityIndicator /> : <Text style={styles.importButtonText}>{t('settings.restoreFromCloud')}</Text>}
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>{t('settings.s3Heading')}</Text>
        <Text style={styles.sectionHint}>{t('settings.s3Hint')}</Text>
        <View style={styles.group}>
          {s3Configs.map((config) => (
            <Pressable key={config.id} style={styles.row} onPress={() => setBrowsingS3Config(config)}>
              <View style={styles.s3ConfigMain}>
                <Text style={styles.rowTitle}>{config.bucket}</Text>
                <Text style={styles.rowValue}>{config.keyPrefix ? `${config.region} · ${config.keyPrefix}` : config.region}</Text>
              </View>
              <RowMenuButton items={[{ label: t('common.delete'), destructive: true, onPress: () => confirmRemoveS3Config(config) }]} />
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.addLink} onPress={() => setS3ModalOpen(true)}>
          <Text style={styles.addLinkText}>{t('settings.addS3BackupLink')}</Text>
        </Pressable>
        <S3ConfigModal visible={s3ModalOpen} onCancel={() => setS3ModalOpen(false)} onSaved={addS3Backup} />
        <S3BrowserModal config={browsingS3Config} onClose={() => setBrowsingS3Config(null)} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>{t('settings.dataHeading')}</Text>
        <Pressable style={styles.importButton} onPress={runImport} disabled={importing}>
          {importing ? <ActivityIndicator /> : <Text style={styles.importButtonText}>{t('settings.importYnab')}</Text>}
        </Pressable>
        {importError ? <Text style={styles.errorText}>{importError}</Text> : null}
        {importResult ? (
          <View style={styles.group}>
            <ImportResultRow label={t('settings.importResultTxnInserted')} value={importResult.transactionsInserted} />
            <ImportResultRow label={t('settings.importResultTxnUpdated')} value={importResult.transactionsUpdated} />
            <ImportResultRow label={t('settings.importResultBudgetWritten')} value={importResult.budgetEntriesWritten} />
            <ImportResultRow label={t('settings.importResultAccountsCreated')} value={importResult.accountsCreated} />
            <ImportResultRow label={t('settings.importResultCategoriesCreated')} value={importResult.categoriesCreated} />
          </View>
        ) : null}
        <Pressable style={styles.importButton} onPress={runRestore} disabled={restoring}>
          {restoring ? <ActivityIndicator /> : <Text style={styles.importButtonText}>{t('settings.importAppBackup')}</Text>}
        </Pressable>
        <Text style={styles.sectionHint}>{t('settings.importAppBackupHint')}</Text>
        {restoreError ? <Text style={styles.errorText}>{restoreError}</Text> : null}
        {restoreResult ? (
          <View style={styles.group}>
            <ImportResultRow label={t('settings.restoreResultBoard')} value={restoreResult.boardName} />
            <ImportResultRow label={t('settings.restoreResultAccounts')} value={restoreResult.accountsImported} />
            <ImportResultRow label={t('settings.restoreResultCategories')} value={restoreResult.categoriesImported} />
            <ImportResultRow label={t('settings.restoreResultTransactions')} value={restoreResult.transactionsImported} />
          </View>
        ) : null}
        <Pressable style={styles.exportButton} onPress={runExport} disabled={exporting}>
          {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.exportButtonText}>{t('settings.exportBoard')}</Text>}
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>{t('settings.aboutHeading')}</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{t('settings.version')}</Text>
            <Text style={styles.rowValue}>1.0.0 (MVP)</Text>
          </View>
        </View>
      </View>

      <PromptModal
        visible={prompt != null}
        title={
          prompt?.type === 'newBoard'
            ? t('settings.newBoardTitle')
            : prompt?.type === 'renamePayee'
              ? t('settings.renamePayeeTitle')
              : t('settings.renameBoardTitle')
        }
        placeholder={prompt?.type === 'renamePayee' ? t('settings.payeeNamePlaceholder') : t('settings.boardNamePlaceholder')}
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
  boardOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  boardOptionMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  s3ConfigMain: { gap: 2 },
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  switchLabel: { fontSize: 15, color: colors.text },
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
