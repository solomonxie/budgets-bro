import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CardModal } from '../../components/ui/CardModal';
import { getDb } from '../../db/client';
import { useBoards, useFirstRunPending } from '../../hooks/useBoards';
import { pickAppExport } from '../../import/pickAppExport';
import { importAppExport } from '../../import/appExportImporter';
import * as boardsRepo from '../../db/repositories/boardsRepo';
import { findICloudBoardBackups } from '../../sync/findICloudBackups';
import type { FoundBoardBackup } from '../../sync/findICloudBackups';
import { useAppStore } from '../../state/useAppStore';
import { enterDemoMode } from '../../demo/demoMode';
import { localeTag, useI18n } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Choice = 'restore' | 'icloud' | 'demo';

// A backup this much older than the newest one is most likely a board that
// was deleted since — offered, but not ticked.
const STALE_BOARD_MS = 60 * 24 * 60 * 60 * 1000;

// Over the empty budget page on a fresh install. Tapping outside is the same
// as Start empty: both are in Settings later.
//
// A reinstall is the moment trust is tested, so it looks in iCloud Drive
// first and, when the boards are there, bringing them back is one tap — no
// hunting through Files for the right zip.
export function FirstRunPrompt() {
  const { t, language } = useI18n();
  const [pending, done] = useFirstRunPending();
  const { switchBoard } = useBoards();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const setDemoModeFlag = useAppStore((s) => s.setDemoModeFlag);
  const [busy, setBusy] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<FoundBoardBackup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    setSearching(true);
    findICloudBoardBackups()
      .then((backups) => {
        if (cancelled) return;
        const newest = new Date(backups[0]?.summary.exportedAt ?? 0).getTime();
        setFound(backups);
        setSelected(
          new Set(
            backups
              .filter((b) => newest - new Date(b.summary.exportedAt ?? 0).getTime() < STALE_BOARD_MS)
              .map((b) => b.key),
          ),
        );
      })
      .catch((e) => console.warn('[firstRun] iCloud lookup failed', e))
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pending]);

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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

  const restore = () =>
    run('restore', async () => {
      const files = await pickAppExport();
      if (!files) return null;
      return (await importAppExport(await getDb(), files)).boardId;
    });

  // The empty board a fresh install starts with would sit beside the restored
  // one under the same name; it goes, but only if nothing was entered in it.
  const restoreFromICloud = () =>
    run('icloud', async () => {
      const db = await getDb();
      const before = await boardsRepo.listBoards(db);
      let first: number | null = null;
      for (const f of found.filter((b) => selected.has(b.key))) {
        const { boardId } = await importAppExport(db, f.backup, { keepName: true });
        first ??= boardId;
      }
      if (first == null) return null;
      for (const board of before) {
        if (await boardsRepo.isBoardUnused(db, board.id)) await boardsRepo.deleteBoard(db, board.id);
      }
      return first;
    });

  // Marked done on the real database first, so leaving demo mode lands on
  // the empty budget rather than this prompt again.
  const tryDemo = async () => {
    setBusy('demo');
    setError(null);
    try {
      await done();
      await enterDemoMode();
      setDemoModeFlag(true);
      bumpDataVersion();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('firstRun.failed'));
    } finally {
      setBusy(null);
    }
  };

  const startEmpty = () => {
    if (!busy) done();
  };

  return (
    <CardModal visible={pending} onCancel={startEmpty}>
      <Text style={styles.title}>{t('firstRun.title')}</Text>
      <Text style={styles.body}>{t('firstRun.body')}</Text>
      {searching ? (
        <View style={styles.searching}>
          <ActivityIndicator size="small" color={colors.textMuted} />
          <Text style={styles.searchingText}>{t('firstRun.searchingICloud')}</Text>
        </View>
      ) : null}
      {found.length > 0 ? (
        <>
          <Text style={styles.foundHeading}>{t('firstRun.foundInICloud')}</Text>
          {found.map((f) => (
            <Pressable key={f.key} style={styles.foundRow} onPress={() => toggle(f.key)} disabled={busy != null}>
              <Text style={[styles.check, selected.has(f.key) && styles.checkOn]}>
                {selected.has(f.key) ? '✓' : ''}
              </Text>
              <View style={styles.foundMain}>
                <Text style={styles.foundName} numberOfLines={1}>
                  {f.summary.boardName ?? f.key}
                </Text>
                <Text style={styles.foundMeta}>
                  {t('firstRun.foundMeta', {
                    date: f.summary.exportedAt
                      ? new Date(f.summary.exportedAt).toLocaleDateString(localeTag(language))
                      : '—',
                    count: f.summary.transactions,
                  })}
                </Text>
              </View>
            </Pressable>
          ))}
          <Option
            label={t('firstRun.restoreSelected', { count: selected.size })}
            primary
            onPress={restoreFromICloud}
            busy={busy === 'icloud'}
            disabled={busy != null || selected.size === 0}
          />
        </>
      ) : null}
      <Option
        label={t('firstRun.tryDemo')}
        primary={found.length === 0}
        onPress={tryDemo}
        busy={busy === 'demo'}
        disabled={busy != null}
      />
      <Option label={t('firstRun.startEmpty')} onPress={startEmpty} disabled={busy != null} />
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
  searching: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchingText: { fontSize: 13, color: colors.textMuted },
  foundHeading: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  foundRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    textAlign: 'center',
    lineHeight: 19,
    fontSize: 14,
    fontWeight: '700',
    color: colors.background,
    overflow: 'hidden',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  foundMain: { flex: 1 },
  foundName: { fontSize: 15, fontWeight: '600', color: colors.text },
  foundMeta: { fontSize: 12, color: colors.textMuted },
});
