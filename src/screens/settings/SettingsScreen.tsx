import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { RowMenuButton } from '../../components/ui/RowMenuButton';
import { PromptModal } from '../../components/ui/PromptModal';
import { SearchableDropdownField } from '../../components/ui/SearchableDropdownField';
import { DropdownField } from '../../components/ui/DropdownField';
import { BackupSection } from './BackupSection';
import { DataSection } from './DataSection';
import { useBoards } from '../../hooks/useBoards';
import { usePayees } from '../../hooks/usePayees';
import { useLanguageSetting } from '../../hooks/useLanguage';
import { getDb } from '../../db/client';
import * as settingsRepo from '../../db/repositories/settingsRepo';
import * as payeesRepo from '../../db/repositories/payeesRepo';
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
import { AiKeyModal } from '../../components/ui/AiKeyModal';
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
  const { payees, refresh: refreshPayees } = usePayees();
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [creatingDemoBoard, setCreatingDemoBoard] = useState(false);
  const [deletingBoardId, setDeletingBoardId] = useState<number | null>(null);
  const [selectedPayeeId, setSelectedPayeeId] = useState<number | null>(null);
  const [payeeNameInput, setPayeeNameInput] = useState('');

  const [theme, setTheme] = useState<ThemePreference>('dark');
  const [aiKeys, setAiKeys] = useState<AiKeyMeta[]>([]);
  const [aiKeyModalOpen, setAiKeyModalOpen] = useState(false);
  const [aiKeyStrategy, setAiKeyStrategyState] =
    useState<AiKeyStrategy>('sequential');
  // A restore can start from a cloud destination or from a picked file; the
  // summary reads the same either way, so it renders once here rather than
  // twice inside the two sections that can produce it.
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
    })();
  }, []);

  const selectTheme = async (next: ThemePreference) => {
    setTheme(next);
    const db = await getDb();
    await settingsRepo.setSetting(db, THEME_KEY, next);
  };

  const addAiKeyRow = async (vendor: AiVendor, secret: string) => {
    const db = await getDb();
    await addAiKey(db, vendor, secret);
    setAiKeys(await listAiKeys(db));
    setAiKeyModalOpen(false);
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
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>{t('settings.boardsHeading')}</Text>
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
                          close(() => confirmDeleteBoard(board.id, board.name)),
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
        <Text style={styles.sectionHeading}>{t('settings.payeesHeading')}</Text>
        <SearchableDropdownField
          compact
          hideLabel
          label={t('settings.payeesHeading')}
          valueLabel={payeeNameInput}
          placeholder={t('settings.payeeSelectPlaceholder')}
          searchPlaceholder={t('settings.payeeSearchPlaceholder')}
          options={payees.map((p) => ({
            id: p.id,
            label: p.linkedAccountId != null ? `${p.name} (account)` : p.name,
          }))}
          onSelect={(o) =>
            selectPayee(o.id, o.label.replace(/ \(account\)$/, ''))
          }
          onUseText={createPayee}
        />
        {selectedPayee != null ? (
          selectedPayee.linkedAccountId != null ? (
            <Text style={styles.sectionHint}>
              {t('settings.payeeLinkedHint')}
            </Text>
          ) : (
            <View style={styles.payeeActions}>
              <Pressable
                style={styles.payeeActionButton}
                onPress={() =>
                  setPrompt({
                    type: 'renamePayee',
                    payeeId: selectedPayee.id,
                    initial: payeeNameInput,
                  })
                }
              >
                <Text style={styles.payeeActionText}>{t('common.rename')}</Text>
              </Pressable>
              <Pressable
                style={styles.payeeActionButton}
                onPress={deleteSelectedPayee}
              >
                <Text style={[styles.payeeActionText, styles.deletePayeeText]}>
                  {t('common.delete')}
                </Text>
              </Pressable>
            </View>
          )
        ) : null}
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
          <Text style={styles.sectionHint}>{t('settings.themeLightHint')}</Text>
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
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeading}>
            {t('settings.aiKeysHeading')}
          </Text>
          {/* Only meaningful once there's more than one key to fall back to. */}
          {aiKeys.length > 1 ? (
            <Pressable
              onPress={() =>
                selectAiKeyStrategy(
                  aiKeyStrategy === 'sequential' ? 'round_robin' : 'sequential',
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
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>
                    {aiVendorName(key.vendor)}
                  </Text>
                  <Text style={styles.rowValue}>
                    {t('settings.aiKeyRequestCount', {
                      count: key.requestCount,
                    })}
                  </Text>
                </View>
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
        <Pressable
          style={styles.addLink}
          onPress={() => setAiKeyModalOpen(true)}
        >
          <Text style={styles.addLinkText}>{t('settings.addAiKeyLink')}</Text>
        </Pressable>
        <AiKeyModal
          visible={aiKeyModalOpen}
          onCancel={() => setAiKeyModalOpen(false)}
          onSaved={addAiKeyRow}
        />
      </View>

      <BackupSection boardId={boardId} boardName={boardName} />

      <DataSection
        boardId={boardId}
        boardName={boardName}
        onImported={bumpDataVersion}
        onRestored={handleRestored}
      />

      {restoreResult ? (
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>
            {t('settings.restoredHeading')}
          </Text>
          <View style={styles.group}>
            <ImportResultRow
              label={t('settings.restoreResultBoard')}
              value={restoreResult.boardName}
            />
            <ImportResultRow
              label={t('settings.restoreResultAccounts')}
              value={restoreResult.accountsImported}
            />
            <ImportResultRow
              label={t('settings.restoreResultCategories')}
              value={restoreResult.categoriesImported}
            />
            <ImportResultRow
              label={t('settings.restoreResultTransactions')}
              value={restoreResult.transactionsImported}
            />
          </View>
        </View>
      ) : null}

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
        placeholder={
          prompt?.type === 'renamePayee'
            ? t('settings.payeeNamePlaceholder')
            : t('settings.boardNamePlaceholder')
        }
        initialValue={prompt && 'initial' in prompt ? prompt.initial : ''}
        onCancel={() => setPrompt(null)}
        onSubmit={submitPrompt}
      />
    </ScreenContainer>
  );
}

function ImportResultRow({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
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
});
