import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { RowMenuButton } from '../../components/ui/RowMenuButton';
import { PromptModal } from '../../components/ui/PromptModal';
import { DropdownField } from '../../components/ui/DropdownField';
import { BackupSection } from './BackupSection';
import { DataSection } from './DataSection';
import { HistorySection } from './HistorySection';
import { useBoards } from '../../hooks/useBoards';
import { useLanguageSetting } from '../../hooks/useLanguage';
import { writeLockMode } from '../../hooks/useAppLock';
import {
  biometryName,
  clearLockSecrets,
  clearPasscode,
  enableBiometricLock,
  authenticateBiometric,
  setPasscode,
} from '../../secure/appLock';
import type { LockMode } from '../../secure/appLock';
import { PasscodeEntry } from '../../components/ui/PasscodeEntry';
import { CardModal } from '../../components/ui/CardModal';
import { getDb } from '../../db/client';
import * as settingsRepo from '../../db/repositories/settingsRepo';
import {
  listAiKeys,
  addAiKey,
  removeAiKey,
  moveAiKey,
  getAiKeyStrategy,
  setAiKeyStrategy,
  aiVendorName,
} from '../../ai/aiKeys';
import type { AiKeyMeta, AiVendor, AiKeyStrategy } from '../../ai/aiKeys';
import { AiKeyForm } from '../../components/ui/AiKeyForm';
import { AiKeyHistoryModal } from '../../components/ui/AiKeyHistoryModal';
import { ResultToast } from '../../components/ui/ResultToast';
import type { AppExportImportResult } from '../../import/appExportImporter';
import { seedDemoBoard } from '../../db/seed/demoBoard';
import { useAppStore } from '../../state/useAppStore';
import { useT, LANGUAGES } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ExpandingFieldGroup } from '../../components/ui/ExpandingField';
import { InfoButton } from '../../components/ui/InfoButton';

const THEME_KEY = 'theme_preference';
type ThemePreference = 'dark' | 'light';

type PromptState =
  | { type: 'newBoard' }
  | { type: 'renameBoard'; boardId: number; initial: string }
  | null;

export function SettingsScreen() {
  const t = useT();
  const { language, selectLanguage } = useLanguageSetting();
  const {
    boards,
    currentBoardId,
    switchBoard,
    addBoard,
    renameBoard,
    removeBoard,
  } = useBoards();
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [creatingDemoBoard, setCreatingDemoBoard] = useState(false);
  const [deletingBoardId, setDeletingBoardId] = useState<number | null>(null);

  const [theme, setTheme] = useState<ThemePreference>('dark');
  const lockMode = useAppStore((s) => s.lockMode);
  const setLockMode = useAppStore((s) => s.setLockMode);
  // Null when this phone has no biometrics enrolled — the third option then
  // says so rather than offering a lock that can never open.
  const [biometry, setBiometry] = useState<string | null>(null);
  // Two passes: type a code, type it again. `first` holds the first pass.
  const [settingPasscode, setSettingPasscode] = useState<{
    first: string | null;
  } | null>(null);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [aiKeys, setAiKeys] = useState<AiKeyMeta[]>([]);
  const [addingAiKey, setAddingAiKey] = useState(false);
  const [aiKeyHistory, setAiKeyHistory] = useState<AiKeyMeta | null>(null);
  const [aiKeyStrategy, setAiKeyStrategyState] =
    useState<AiKeyStrategy>('sequential');
  // What the last restore brought in, shown once and then gone: the numbers
  // are worth confirming the moment they land and worth nothing afterwards.
  const [restoreResult, setRestoreResult] =
    useState<AppExportImportResult | null>(null);

  const boardName = boards.find((b) => b.id === boardId)?.name ?? '';

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const savedTheme = await settingsRepo.getSetting(db, THEME_KEY);
      if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme);
      setAiKeys(await listAiKeys(db));
      setAiKeyStrategyState(await getAiKeyStrategy(db));
      setBiometry(await biometryName());
    })();
  }, []);

  // Switching the lock off clears both secrets; switching it on proves the
  // new lock works *before* it is saved, so nobody ends up holding a key
  // that doesn't turn.
  const selectLockMode = async (next: LockMode) => {
    if (next === lockMode) return;
    if (next === 'passcode') {
      setPasscodeError(null);
      setSettingPasscode({ first: null });
      return;
    }
    if (next === 'biometric') {
      if (!biometry) {
        Alert.alert(t('lock.noBiometryTitle'), t('lock.noBiometryMessage'));
        return;
      }
      await enableBiometricLock();
      if (!(await authenticateBiometric(t('lock.biometricPrompt')))) return;
      await clearPasscode();
      await writeLockMode('biometric');
      setLockMode('biometric');
      return;
    }
    await clearLockSecrets();
    await writeLockMode('none');
    setLockMode('none');
  };

  const submitNewPasscode = async (code: string) => {
    if (settingPasscode?.first == null) {
      setPasscodeError(null);
      setSettingPasscode({ first: code });
      return;
    }
    if (settingPasscode.first !== code) {
      setPasscodeError(t('lock.passcodeMismatch'));
      setSettingPasscode({ first: null });
      return;
    }
    await setPasscode(code);
    await writeLockMode('passcode');
    setLockMode('passcode');
    setSettingPasscode(null);
    setPasscodeError(null);
  };

  const selectTheme = async (next: ThemePreference) => {
    setTheme(next);
    const db = await getDb();
    await settingsRepo.setSetting(db, THEME_KEY, next);
  };

  const addAiKeyRow = async (vendor: AiVendor, secret: string) => {
    const db = await getDb();
    await addAiKey(db, vendor, secret);
    setAiKeys(await listAiKeys(db));
    setAddingAiKey(false);
  };

  const confirmRemoveAiKey = (key: AiKeyMeta) => {
    Alert.alert(
      t('settings.deleteAiKeyConfirmTitle'),
      t('settings.deleteAiKeyConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const db = await getDb();
            await removeAiKey(db, key.id);
            setAiKeys(await listAiKeys(db));
          },
        },
      ],
    );
  };

  const moveAiKeyRow = async (id: string, direction: -1 | 1) => {
    const db = await getDb();
    await moveAiKey(db, id, direction);
    setAiKeys(await listAiKeys(db));
  };

  const selectAiKeyStrategy = async (strategy: AiKeyStrategy) => {
    setAiKeyStrategyState(strategy);
    const db = await getDb();
    await setAiKeyStrategy(db, strategy);
  };

  // Every restore lands as a brand-new board and switches to it — see
  // appExportImporter. Both entry points funnel through here.
  const handleRestored = async (summary: AppExportImportResult) => {
    setRestoreResult(summary);
    bumpDataVersion();
    await switchBoard(summary.boardId);
  };

  const submitPrompt = async (value: string) => {
    if (prompt?.type === 'newBoard') {
      const id = await addBoard(value);
      await switchBoard(id);
    } else if (prompt?.type === 'renameBoard') {
      await renameBoard(prompt.boardId, value);
    }
    setPrompt(null);
  };

  // Always makes a fresh one — deleting the demo board doesn't bring it back
  // on its own (see useEnsureDemoBoard), so this is the only way back.
  // Seeding is a few hundred sequential writes (24 months of transactions
  // across a dozen accounts) — a few seconds, not instant — so this guards
  // against a second tap starting a duplicate board mid-seed and surfaces
  // a failure instead of leaving the UI looking stuck with no feedback.
  const runCreateDemoBoard = async () => {
    if (creatingDemoBoard) return;
    setCreatingDemoBoard(true);
    try {
      const db = await getDb();
      const id = await seedDemoBoard(db);
      bumpDataVersion();
      await switchBoard(id);
    } catch {
      Alert.alert(t('settings.createDemoBoardFailed'));
    } finally {
      setCreatingDemoBoard(false);
    }
  };

  // Guards against a double-tap firing two overlapping deletes (deleteBoard's
  // transaction isn't exclusive, so two interleaved runs can step on each
  // other) and surfaces a failure instead of leaving the row looking stuck
  // with no feedback — same pattern as runCreateDemoBoard above.
  const runDeleteBoard = async (id: number) => {
    if (deletingBoardId != null) return;
    setDeletingBoardId(id);
    try {
      await removeBoard(id);
    } catch {
      Alert.alert(t('settings.deleteBoardFailed'));
    } finally {
      setDeletingBoardId(null);
    }
  };

  const confirmDeleteBoard = (id: number, name: string) => {
    if (boards.length <= 1) {
      Alert.alert(
        t('settings.cantDeleteOnlyBoardTitle'),
        t('settings.cantDeleteOnlyBoardMessage'),
      );
      return;
    }
    Alert.alert(
      t('settings.deleteBoardConfirmTitle', { name }),
      t('settings.deleteBoardConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => runDeleteBoard(id),
        },
      ],
    );
  };

  return (
    <ScreenContainer scroll modal>
      <ExpandingFieldGroup>
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>
            {t('settings.boardsHeading')}
          </Text>
          <Text style={styles.sectionHint}>{t('settings.boardsHint')}</Text>
          {creatingDemoBoard ? (
            <Text style={styles.sectionHint}>
              {t('settings.creatingDemoBoard')}
            </Text>
          ) : null}
          {deletingBoardId != null ? (
            <Text style={styles.sectionHint}>{t('common.deleting')}</Text>
          ) : null}
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
                      <View
                        style={[
                          styles.radio,
                          board.id === currentBoardId && styles.radioActive,
                        ]}
                      />
                      <Text style={styles.rowTitle}>{board.name}</Text>
                    </Pressable>
                    <RowMenuButton
                      items={[
                        {
                          label: t('common.rename'),
                          // `close(after)` waits for this picker sheet to
                          // actually finish dismissing before running `after`
                          // — presenting the rename prompt on top of a still-
                          // animating dismissal can wedge iOS's window
                          // presentation state entirely (screen looks normal,
                          // but no touch ever lands again — see delete-board
                          // freeze investigation). RowMenuButton does the same
                          // for its own "⋯" sheet, so both close in sequence.
                          onPress: () =>
                            close(() =>
                              setPrompt({
                                type: 'renameBoard',
                                boardId: board.id,
                                initial: board.name,
                              }),
                            ),
                        },
                        {
                          label: t('common.delete'),
                          destructive: true,
                          onPress: () =>
                            close(() =>
                              confirmDeleteBoard(board.id, board.name),
                            ),
                        },
                      ]}
                    />
                  </View>
                ))}
                <Pressable
                  style={styles.addLink}
                  onPress={() => close(() => setPrompt({ type: 'newBoard' }))}
                >
                  <Text style={styles.addLinkText}>
                    {t('settings.newBoardLink')}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.addLink}
                  onPress={() => close(runCreateDemoBoard)}
                >
                  <Text style={styles.addLinkText}>
                    {t('settings.createDemoBoard')}
                  </Text>
                </Pressable>
              </>
            )}
          </DropdownField>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>
            {t('settings.appearanceHeading')}
          </Text>
          <View style={styles.segmented}>
            {(['dark', 'light'] as const).map((opt) => (
              <Pressable
                key={opt}
                style={[styles.segment, theme === opt && styles.segmentActive]}
                onPress={() => selectTheme(opt)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    theme === opt && styles.segmentTextActive,
                  ]}
                >
                  {opt === 'dark'
                    ? t('settings.themeDark')
                    : t('settings.themeLight')}
                </Text>
              </Pressable>
            ))}
          </View>
          {theme === 'light' ? (
            <Text style={styles.sectionHint}>
              {t('settings.themeLightHint')}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>
            {t('settings.languageHeading')}
          </Text>
          <View style={styles.segmented}>
            {LANGUAGES.map((opt) => (
              <Pressable
                key={opt.code}
                style={[
                  styles.segment,
                  language === opt.code && styles.segmentActive,
                ]}
                onPress={() => selectLanguage(opt.code)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    language === opt.code && styles.segmentTextActive,
                  ]}
                >
                  {t(opt.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>
            {t('settings.lockHeading')}
          </Text>
          <View style={styles.segmented}>
            {(['none', 'passcode', 'biometric'] as const).map((opt) => (
              <Pressable
                key={opt}
                style={[
                  styles.segment,
                  lockMode === opt && styles.segmentActive,
                ]}
                onPress={() => selectLockMode(opt)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    lockMode === opt && styles.segmentTextActive,
                  ]}
                >
                  {opt === 'none'
                    ? t('lock.modeNone')
                    : opt === 'passcode'
                      ? t('lock.modePasscode')
                      : (biometry ?? t('lock.modeBiometricUnavailable'))}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sectionHint}>{t('settings.lockHint')}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.headingWithInfo}>
              <Text style={styles.sectionHeading}>
                {t('settings.aiKeysHeading')}
              </Text>
              <InfoButton
                title={t('aiInfo.title')}
                paragraphs={[
                  t('aiInfo.what'),
                  t('aiInfo.ownAccount'),
                  t('aiInfo.whereToRegister'),
                  t('aiInfo.cost'),
                  t('aiInfo.privacy'),
                ]}
                closeLabel={t('common.done')}
              />
            </View>
            {/* Only meaningful once there's more than one key to fall back to. */}
            {aiKeys.length > 1 ? (
              <Pressable
                onPress={() =>
                  selectAiKeyStrategy(
                    aiKeyStrategy === 'sequential'
                      ? 'round_robin'
                      : 'sequential',
                  )
                }
              >
                <Text style={styles.strategyLinkText}>
                  {aiKeyStrategy === 'sequential'
                    ? t('settings.aiKeyStrategySequential')
                    : t('settings.aiKeyStrategyRoundRobin')}{' '}
                  ▾
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.sectionHint}>{t('settings.aiKeysHint')}</Text>
          {aiKeys.length > 0 ? (
            <View style={styles.group}>
              {aiKeys.map((key, i) => (
                <View
                  key={key.id}
                  style={[styles.row, i > 0 && styles.rowDivider]}
                >
                  <Pressable
                    style={styles.rowMain}
                    onPress={() => setAiKeyHistory(key)}
                  >
                    <Text style={styles.rowTitle}>
                      {aiVendorName(key.vendor)}
                    </Text>
                    <Text style={styles.rowValue}>
                      {t('settings.aiKeyRequestCount', {
                        count: key.requestCount,
                      })}
                    </Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    disabled={i === 0}
                    onPress={() => moveAiKeyRow(key.id, -1)}
                  >
                    <Text
                      style={[
                        styles.reorderArrow,
                        i === 0 && styles.reorderArrowDisabled,
                      ]}
                    >
                      ↑
                    </Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    disabled={i === aiKeys.length - 1}
                    onPress={() => moveAiKeyRow(key.id, 1)}
                  >
                    <Text
                      style={[
                        styles.reorderArrow,
                        i === aiKeys.length - 1 && styles.reorderArrowDisabled,
                      ]}
                    >
                      ↓
                    </Text>
                  </Pressable>
                  <RowMenuButton
                    items={[
                      {
                        label: t('common.delete'),
                        destructive: true,
                        onPress: () => confirmRemoveAiKey(key),
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
          ) : null}
          {addingAiKey ? (
            <AiKeyForm
              onSaved={addAiKeyRow}
              onCancel={() => setAddingAiKey(false)}
            />
          ) : (
            <Pressable
              style={styles.addLink}
              onPress={() => setAddingAiKey(true)}
            >
              <Text style={styles.addLinkText}>
                {t('settings.addAiKeyLink')}
              </Text>
            </Pressable>
          )}
          <AiKeyHistoryModal
            aiKey={aiKeyHistory}
            onClose={() => setAiKeyHistory(null)}
          />
        </View>

        <BackupSection boardId={boardId} boardName={boardName} />

        <DataSection
          boardId={boardId}
          boardName={boardName}
          onImported={bumpDataVersion}
          onRestored={handleRestored}
        >
          <HistorySection />
        </DataSection>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>
            {t('settings.aboutHeading')}
          </Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{t('settings.version')}</Text>
              <Text style={styles.rowValue}>1.0.0 (MVP)</Text>
            </View>
          </View>
        </View>

        <ResultToast
          visible={restoreResult != null}
          title={t('settings.restoredHeading')}
          lines={
            restoreResult
              ? [
                  {
                    label: t('settings.restoreResultBoard'),
                    value: restoreResult.boardName,
                  },
                  {
                    label: t('settings.restoreResultAccounts'),
                    value: String(restoreResult.accountsImported),
                  },
                  {
                    label: t('settings.restoreResultCategories'),
                    value: String(restoreResult.categoriesImported),
                  },
                  {
                    label: t('settings.restoreResultTransactions'),
                    value: String(restoreResult.transactionsImported),
                  },
                ]
              : []
          }
          onDismiss={() => setRestoreResult(null)}
        />

        <CardModal
          visible={settingPasscode != null}
          onCancel={() => {
            setSettingPasscode(null);
            setPasscodeError(null);
          }}
        >
          <PasscodeEntry
            title={t(
              settingPasscode?.first == null
                ? 'lock.setPasscodeTitle'
                : 'lock.confirmPasscodeTitle',
            )}
            subtitle={t('lock.setPasscodeHint')}
            error={passcodeError}
            onComplete={submitNewPasscode}
            onCancel={() => {
              setSettingPasscode(null);
              setPasscodeError(null);
            }}
            cancelLabel={t('common.cancel')}
          />
        </CardModal>

        <PromptModal
          visible={prompt != null}
          title={
            prompt?.type === 'newBoard'
              ? t('settings.newBoardTitle')
              : t('settings.renameBoardTitle')
          }
          placeholder={t('settings.boardNamePlaceholder')}
          initialValue={prompt && 'initial' in prompt ? prompt.initial : ''}
          onCancel={() => setPrompt(null)}
          onSubmit={submitPrompt}
        />
      </ExpandingFieldGroup>
    </ScreenContainer>
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
  headingWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strategyLinkText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  sectionHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  boardOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  boardOptionMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  rowMain: { flex: 1, gap: 2 },
  reorderArrow: {
    fontSize: 16,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  reorderArrowDisabled: { opacity: 0.3 },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  rowTitle: { fontSize: 15, color: colors.text },
  rowValue: { fontSize: 13, color: colors.textMuted },
  addLink: { alignItems: 'center', paddingVertical: spacing.sm },
  addLinkText: { color: colors.accent, fontWeight: '700' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
});
