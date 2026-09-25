import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { CardModal } from '../../components/ui/CardModal';
import { getDb } from '../../db/client';
import { seedDemoBoard } from '../../db/seed/demoBoard';
import { useBoards, useFirstRunPending } from '../../hooks/useBoards';
import { pickAppExport } from '../../import/pickAppExport';
import { importAppExport } from '../../import/appExportImporter';
import { useAppStore } from '../../state/useAppStore';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Choice = 'demo' | 'restore';

// Over the empty budget page on a fresh install. Tapping outside is the same
// as Start empty: both are in Settings later.
export function FirstRunPrompt() {
  const t = useT();
  const [pending, done] = useFirstRunPending();
  const { switchBoard } = useBoards();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const [busy, setBusy] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (choice: Choice, work: () => Promise<number | null>) => {
    setBusy(choice);
    setError(null);
    try {
      const boardId = await work();
      // Cancelled the file picker: still undecided.
      if (boardId == null) return;
      bumpDataVersion();
      await switchBoard(boardId);
      await done();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('firstRun.failed'));
    } finally {
      setBusy(null);
    }
  };

  const tryDemo = () => run('demo', async () => seedDemoBoard(await getDb()));

  const restore = () =>
    run('restore', async () => {
      const files = await pickAppExport();
      if (!files) return null;
      return (await importAppExport(await getDb(), files)).boardId;
    });

  const startEmpty = () => {
    if (!busy) done();
  };

  return (
    <CardModal visible={pending} onCancel={startEmpty}>
      <Text style={styles.title}>{t('firstRun.title')}</Text>
      <Text style={styles.body}>{t('firstRun.body')}</Text>
      <Option label={t('firstRun.startEmpty')} primary onPress={startEmpty} disabled={busy != null} />
      <Option label={t('firstRun.tryDemo')} onPress={tryDemo} busy={busy === 'demo'} disabled={busy != null} />
      <Option label={t('firstRun.restore')} onPress={restore} busy={busy === 'restore'} disabled={busy != null} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </CardModal>
  );
}

function Option({
  label,
  onPress,
  primary,
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable style={[styles.option, primary && styles.primary]} onPress={onPress} disabled={disabled}>
      {busy ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <Text style={[styles.optionText, primary && styles.primaryText]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.xs },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 46,
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  optionText: { fontSize: 15, fontWeight: '600', color: colors.text },
  primaryText: { color: colors.background },
  error: { fontSize: 12, color: colors.negative },
});
