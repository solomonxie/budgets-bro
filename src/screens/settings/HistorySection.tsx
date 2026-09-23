import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { getDb } from '../../db/client';
import * as changeLogRepo from '../../db/repositories/changeLogRepo';
import type { ChangeGroup } from '../../db/repositories/changeLogRepo';
import {
  listSnapshots,
  restoreSnapshot,
  takeSnapshot,
} from '../../db/preMigrationSnapshot';
import type { DbSnapshot } from '../../db/preMigrationSnapshot';
import { useAppStore } from '../../state/useAppStore';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const OP_LABELS: Record<ChangeGroup['op'], TranslationKey> = {
  insert: 'history.changeInsert',
  update: 'history.changeUpdate',
  delete: 'history.changeDelete',
};

// The tables a person recognises. Anything not listed falls back to its own
// name, which is better than pretending to know what it is.
const TABLE_LABELS: Record<string, TranslationKey> = {
  accounts: 'history.tableAccounts',
  categories: 'history.tableCategories',
  category_groups: 'history.tableCategoryGroups',
  budget_entries: 'history.tableBudgetEntries',
  payees: 'history.tablePayees',
  transactions: 'history.tableTransactions',
  account_value_history: 'history.tableValueHistory',
  account_rate_history: 'history.tableRateHistory',
  scheduled_transactions: 'history.tableScheduled',
  custom_goals: 'history.tableGoals',
};

function tableLabel(table: string): TranslationKey {
  return TABLE_LABELS[table] ?? ('history.tableUnknown' as TranslationKey);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}

// Two ways back, from the same page because the choice between them is the
// point: the log undoes one change, a snapshot puts everything back.
//
// Reach for the log when you know what went wrong — a relabel that hit too
// many rows, a migration that cleared a column. Reach for a snapshot when you
// don't, or when what went wrong was the shape of the database rather than
// its contents, which no row-level undo can put right.
const PAGE_SIZE = 30;

export function HistorySection() {
  const t = useT();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<ChangeGroup[]>([]);
  const [nextBeforeSeq, setNextBeforeSeq] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [snapshots, setSnapshots] = useState<DbSnapshot[]>([]);
  const [busy, setBusy] = useState(false);

  // Undo/rewind/prune all shift the log around under whatever page is on
  // screen, so a refresh starts back at page one rather than trying to
  // reconcile a cursor against a log that just changed underneath it.
  const refresh = useCallback(async () => {
    const db = await getDb();
    const page = await changeLogRepo.listChangeGroups(db, undefined, PAGE_SIZE);
    setGroups(page.groups);
    setNextBeforeSeq(page.nextBeforeSeq);
    setSnapshots(await listSnapshots());
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || nextBeforeSeq == null) return;
    setLoadingMore(true);
    try {
      const db = await getDb();
      const page = await changeLogRepo.listChangeGroups(
        db,
        nextBeforeSeq,
        PAGE_SIZE,
      );
      setGroups((prev) => [...prev, ...page.groups]);
      setNextBeforeSeq(page.nextBeforeSeq);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextBeforeSeq]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const confirmUndo = (group: ChangeGroup) => {
    Alert.alert(
      t('history.undoConfirmTitle', { count: group.count, table: group.table }),
      t('history.undoConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('history.undo'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const db = await getDb();
              await changeLogRepo.undoGroup(db, group);
              bumpDataVersion();
              await refresh();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  // An import is one action that happens to be written a row at a time over
  // several seconds, so undoing it means undoing everything from where it
  // started, not the last second of it.
  const confirmRewind = async (group: ChangeGroup) => {
    const db = await getDb();
    const rows = await changeLogRepo.countSince(db, group.firstSeq);
    Alert.alert(
      t('history.rewindConfirmTitle', { count: rows }),
      t('history.rewindConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('history.rewind'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await changeLogRepo.undoSince(db, group.firstSeq);
              bumpDataVersion();
              await refresh();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const confirmRestoreSnapshot = (snapshot: DbSnapshot) => {
    Alert.alert(
      t('history.restoreSnapshotTitle'),
      t('history.restoreSnapshotMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('backup.restore'),
          style: 'destructive',
          onPress: () => {
            // Replacing the file under a live connection is why this asks the
            // user to reopen the app rather than pretending it took effect.
            restoreSnapshot('budgetsbro.db', snapshot.name);
            Alert.alert(
              t('history.restoredTitle'),
              t('history.restoredMessage'),
            );
          },
        },
      ],
    );
  };

  const snapshotNow = async () => {
    setBusy(true);
    try {
      const db = await getDb();
      await db.execAsync('PRAGMA wal_checkpoint(FULL)');
      takeSnapshot('budgetsbro.db', 0, 0);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* A row of the Data card (see DataSection), not a link floating under
          it — opening the log is the same kind of act as exporting. */}
      <Pressable
        style={[styles.triggerRow, styles.rowDivider]}
        onPress={() => setOpen(true)}
      >
        <View style={styles.triggerMain}>
          <Text style={styles.triggerLabel}>{t('history.open')}</Text>
          <Text style={styles.triggerHint}>{t('history.openHint')}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <ScreenContainer modal>
          <View style={styles.header}>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.headerBtn}>{t('common.done')}</Text>
            </Pressable>
            <Text style={styles.title}>{t('history.title')}</Text>
            {busy ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={[styles.headerBtn, { opacity: 0 }]}>
                {t('common.done')}
              </Text>
            )}
          </View>

          <FlatList
            data={groups}
            keyExtractor={(group) => `${group.firstSeq}`}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={
              <>
                <Text style={styles.heading}>
                  {t('history.snapshotsHeading')}
                </Text>
                <Text style={styles.hint}>{t('history.snapshotsHint')}</Text>
                {snapshots.length === 0 ? (
                  <Text style={styles.hint}>{t('history.noSnapshots')}</Text>
                ) : null}
                {snapshots.map((snapshot) => (
                  <View key={snapshot.name} style={styles.row}>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle}>
                        {new Date(snapshot.takenAt).toLocaleString()}
                      </Text>
                      <Text style={styles.rowSub}>
                        {snapshot.fromVersion === snapshot.toVersion
                          ? t('history.snapshotManual', {
                              size: formatBytes(snapshot.sizeBytes),
                            })
                          : t('history.snapshotBeforeMigration', {
                              from: snapshot.fromVersion,
                              to: snapshot.toVersion,
                              size: formatBytes(snapshot.sizeBytes),
                            })}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => confirmRestoreSnapshot(snapshot)}
                      hitSlop={8}
                    >
                      <Text style={styles.action}>{t('backup.restore')}</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  style={styles.addBtn}
                  onPress={snapshotNow}
                  disabled={busy}
                >
                  <Text style={styles.addBtnText}>
                    {t('history.snapshotNow')}
                  </Text>
                </Pressable>

                <Text style={styles.heading}>
                  {t('history.changesHeading')}
                </Text>
                <Text style={styles.hint}>{t('history.changesHint')}</Text>
                {groups.length === 0 ? (
                  <Text style={styles.hint}>{t('history.noChanges')}</Text>
                ) : null}
              </>
            }
            renderItem={({ item: group }) => (
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  {/* What was touched, in the app's own words rather than
                      the table's — "Edited accounts", not "update /
                      accounts". The name underneath is the row itself where
                      it had one, which is usually the thing you are actually
                      looking for. */}
                  <Text style={styles.rowTitle}>
                    {t(OP_LABELS[group.op], {
                      what: t(tableLabel(group.table)),
                    })}
                  </Text>
                  <Text style={styles.rowSub}>
                    {[
                      group.sampleName,
                      t('history.rowCount', { count: group.count }),
                      new Date(
                        `${group.at.replace(' ', 'T')}Z`,
                      ).toLocaleString(),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => confirmUndo(group)}
                  hitSlop={8}
                  disabled={busy}
                >
                  <Text style={styles.action}>{t('history.undo')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => confirmRewind(group)}
                  hitSlop={8}
                  disabled={busy}
                >
                  <Text style={styles.action}>{t('history.rewind')}</Text>
                </Pressable>
              </View>
            )}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator style={styles.footerSpinner} />
              ) : null
            }
          />
        </ScreenContainer>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  triggerMain: { flex: 1, gap: 2 },
  triggerLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  triggerHint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  chevron: { fontSize: 18, color: colors.textMuted },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  heading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  action: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  addBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  addBtnText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  footerSpinner: { paddingVertical: spacing.md },
});
