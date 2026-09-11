import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import { RowMenuButton } from '../../components/ui/RowMenuButton';
import { PromptModal } from '../../components/ui/PromptModal';
import { useBoards } from '../../hooks/useBoards';
import { getDb } from '../../db/client';
import * as settingsRepo from '../../db/repositories/settingsRepo';
import { secureStore } from '../../secure/secureStore';
import { exportBoardZip } from '../../export/exportBoard';
import { useAppStore } from '../../state/useAppStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const THEME_KEY = 'theme_preference';
type ThemePreference = 'dark' | 'light';

type PromptState = { type: 'newBoard' } | { type: 'renameBoard'; boardId: number; initial: string } | null;

export function SettingsScreen() {
  const { boards, currentBoardId, switchBoard, addBoard, renameBoard, removeBoard } = useBoards();
  const boardId = useAppStore((s) => s.currentBoardId);
  const [prompt, setPrompt] = useState<PromptState>(null);

  const [theme, setTheme] = useState<ThemePreference>('dark');
  const [aiApiKey, setAiApiKey] = useState('');
  const [s3AccessKeyId, setS3AccessKeyId] = useState('');
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState('');
  const [exporting, setExporting] = useState(false);

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
    }
    setPrompt(null);
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
        <Text style={styles.sectionHint}>Used by AI Analysis. Stored securely on this device only.</Text>
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
        <Text style={styles.sectionHint}>Used for cloud backups. Stored securely on this device only.</Text>
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
        title={prompt?.type === 'newBoard' ? 'New Board' : 'Rename Board'}
        placeholder="e.g. Personal Budget"
        initialValue={prompt && 'initial' in prompt ? prompt.initial : ''}
        onCancel={() => setPrompt(null)}
        onSubmit={submitPrompt}
      />
    </ScreenContainer>
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
  exportButton: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  exportButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
