import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { getDb } from '../../db/client';
import { useT } from '../../i18n';
import { relativeTime } from '../../i18n/relativeTime';
import { forgetSyncDevice, listSyncDevices } from '../../sync/browserSync';
import type { SyncDevice } from '../../sync/browserSync';
import type { ConflictRow } from '../../sync/conflictRows';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface DevicesSheetProps {
  visible: boolean;
  // Names already known from the last pull, shown until the bucket answers.
  cachedNames: Record<string, string>;
  onClose: () => void;
  onChanged: () => void;
}

export function DevicesSheet({ visible, cachedNames, onClose, onChanged }: DevicesSheetProps) {
  const t = useT();
  const [devices, setDevices] = useState<SyncDevice[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    setDevices(null);
    getDb()
      .then(listSyncDevices)
      .then((list) => live && setDevices(list))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [visible]);

  const shown: SyncDevice[] =
    devices ??
    [
      { id: 'me', name: t('browserSync.thisDevice'), kind: 'phone', lastSeen: null, mine: true },
      ...Object.entries(cachedNames).map(([id, name]) => ({
        id,
        name,
        kind: 'browser' as const,
        lastSeen: null,
        mine: false,
      })),
    ];

  const forget = async (id: string) => {
    await forgetSyncDevice(await getDb(), id);
    setDevices((list) => list?.filter((d) => d.id !== id) ?? null);
    onChanged();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BottomSheet title={t('browserSync.devices')} onClose={onClose}>
        {shown.map((d) => (
          <View key={d.id} style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {d.mine ? t('browserSync.thisDevice') : d.name}
            </Text>
            <Text style={styles.meta}>
              {d.mine
                ? t('browserSync.now')
                : d.lastSeen != null
                  ? relativeTime(new Date(d.lastSeen).toISOString(), t)
                  : ''}
            </Text>
            {d.mine || devices == null ? null : (
              <Pressable onPress={() => void forget(d.id)} hitSlop={8}>
                <Text style={styles.forget}>{t('browserSync.forget')}</Text>
              </Pressable>
            )}
          </View>
        ))}
        <Text style={styles.hint}>{t('browserSync.forgetHint')}</Text>
      </BottomSheet>
    </Modal>
  );
}

interface ConflictsSheetProps {
  visible: boolean;
  rows: ConflictRow[];
  onClose: () => void;
  onOpen: (transactionId: number) => void;
}

export function ConflictsSheet({ visible, rows, onClose, onOpen }: ConflictsSheetProps) {
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BottomSheet title={t('browserSync.conflicts')} onClose={onClose}>
        {rows.map((r) => (
          <Pressable
            key={r.key}
            style={styles.row}
            disabled={r.transactionId == null}
            onPress={() => r.transactionId != null && onOpen(r.transactionId)}
          >
            <Text style={styles.name} numberOfLines={1}>
              {`${r.label} · ${r.field}`}
            </Text>
            {r.transactionId != null ? <Text style={styles.chevron}>›</Text> : null}
          </Pressable>
        ))}
      </BottomSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { flex: 1, fontSize: 15, color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  forget: { fontSize: 13, color: colors.negative, fontWeight: '600' },
  chevron: { fontSize: 18, color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, paddingTop: spacing.sm },
});
