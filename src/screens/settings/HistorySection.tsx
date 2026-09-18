import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { getDb } from '../../db/client';
import * as changeLogRepo from '../../db/repositories/changeLogRepo';
import type { ChangeGroup } from '../../db/repositories/changeLogRepo';
import { listSnapshots, restoreSnapshot, takeSnapshot } from '../../db/preMigrationSnapshot';
import type { DbSnapshot } from '../../db/preMigrationSnapshot';
import { useAppStore } from '../../state/useAppStore';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

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
export function HistorySection() {
  const t = useT();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<ChangeGroup[]>([]);
  const [snapshots, setSnapshots] = useState<DbSnapshot[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setGroups(await changeLogRepo.listChangeGroups(db));
    setSnapshots(listSnapshots());
  }, []);

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
    Alert.alert(t('history.rewindConfirmTitle', { count: rows }), t('history.rewindConfirmMessage'), [
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
    ]);
  };

  const confirmRestoreSnapshot = (snapshot: DbSnapshot) => {
    Alert.alert(t('history.restoreSnapshotTitle'), t('history.restoreSnapshotMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backup.restore'),
        style: 'destructive',
        onPress: () => {
          // Replacing the file under a live connection is why this asks the
          // user to reopen the app rather than pretending it took effect.
          restoreSnapshot('budgetsbro.db', snapshot.name);
          Alert.alert(t('history.restoredTitle'), t('history.restoredMessage'));
        },
      },
    ]);
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
    <View style={styles.section}>
      <Pressable onPress={() => setOpen(true)} hitSlop={8}>
        <Text style={styles.link}>{t('history.open')}</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <ScreenContainer modal>
          <View style={styles.header}>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.headerBtn}>{t('common.done')}</Text>
            </Pressable>
            <Text style={styles.title}>{t('history.title')}</Text>
            {busy ? <ActivityIndicator size="small" /> : <Text style={[styles.headerBtn, { opacity: 0 }]}>{t('common.done')}</Text>}
          </View>

          <ScrollView>
            <Text style={styles.heading}>{t('history.snapshotsHeading')}</Text>
            <Text style={styles.hint}>{t('history.snapshotsHint')}</Text>
            {snapshots.length === 0 ? <Text style={styles.hint}>{t('history.noSnapshots')}</Text> : null}
            {snapshots.map((snapshot) => (
              <View key={snapshot.name} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{new Date(snapshot.takenAt).toLocaleString()}</Text>
                  <Text style={styles.rowSub}>
                    {snapshot.fromVersion === snapshot.toVersion
                      ? t('history.snapshotManual', { size: formatBytes(snapshot.sizeBytes) })
                      : t('history.snapshotBeforeMigration', {
                          from: snapshot.fromVersion,
                          to: snapshot.toVersion,
                          size: formatBytes(snapshot.sizeBytes),
                        })}
                  </Text>
                </View>
                <Pressable onPress={() => confirmRestoreSnapshot(snapshot)} hitSlop={8}>
                  <Text style={styles.action}>{t('backup.restore')}</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addBtn} onPress={snapshotNow} disabled={busy}>
              <Text style={styles.addBtnText}>{t('history.snapshotNow')}</Text>
            </Pressable>

            <Text style={styles.heading}>{t('history.changesHeading')}</Text>
            <Text style={styles.hint}>{t('history.changesHint')}</Text>
            {groups.length === 0 ? <Text style={styles.hint}>{t('history.noChanges')}</Text> : null}
            {groups.map((group) => (
              <View key={`${group.firstSeq}`} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>
                    {t(`history.op${group.op.charAt(0).toUpperCase()}${group.op.slice(1)}` as 'history.opInsert')}{' '}
                    {t('history.rowCount', { count: group.count })}
                  </Text>
                  <Text style={styles.rowSub}>
                    {group.table} · {new Date(`${group.at.replace(' ', 'T')}Z`).toLocaleString()}
                  </Text>
                </View>
                <Pressable onPress={() => confirmUndo(group)} hitSlop={8} disabled={busy}>
                  <Text style={styles.action}>{t('history.undo')}</Text>
                </Pressable>
                <Pressable onPress={() => confirmRewind(group)} hitSlop={8} disabled={busy}>
                  <Text style={styles.action}>{t('history.rewind')}</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </ScreenContainer>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { alignItems: 'center', marginBottom: spacing.md },
  link: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  heading: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted, marginTop: spacing.md },
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
});
