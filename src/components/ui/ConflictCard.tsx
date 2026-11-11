import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ConflictValue, FieldConflict } from '../../sync/conflicts';
import type { Scalar } from '../../../sync-core/types';
import { relativeTime } from '../../i18n/relativeTime';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface ConflictCardProps {
  conflict: FieldConflict;
  fieldLabel: string;
  onPick: (value: Scalar) => void;
}

// Under a text field two devices edited without seeing each other's edit
// (docs/design/browser-sync/uiux/sync.md). Either button is a new edit made
// after both, so it clears on every device.
export function ConflictCard({ conflict, fieldLabel, onPick }: ConflictCardProps) {
  const t = useT();
  const who = (v: ConflictValue) => v.deviceName ?? t('browserSync.anotherDevice');
  const label = (v: ConflictValue) =>
    v.mine
      ? t('browserSync.thisDevice')
      : `${who(v)} · ${relativeTime(new Date(v.at).toISOString(), t)}`;
  const shown = (x: Scalar) => (x == null || x === '' ? t('browserSync.emptyValue') : String(x));

  return (
    <View style={styles.card} testID="conflict-card">
      <Text style={styles.title}>⚠ {t('browserSync.conflictTitle', { field: fieldLabel })}</Text>
      {[conflict.current, ...conflict.others].map((v) => (
        <View key={`${v.device}${v.at}`} style={styles.row}>
          <Text style={styles.who}>{label(v)}:</Text>
          <Text style={styles.value}>{shown(v.value)}</Text>
        </View>
      ))}
      <View style={styles.buttons}>
        <Pressable style={styles.button} onPress={() => onPick(conflict.current.value)}>
          <Text style={styles.buttonText}>{t('browserSync.conflictKeep')}</Text>
        </Pressable>
        {conflict.others.map((v) => (
          <Pressable key={`${v.device}${v.at}`} style={styles.button} onPress={() => onPick(v.value)}>
            <Text style={styles.buttonText}>
              {v.mine ? t('browserSync.conflictUseMine') : t('browserSync.conflictUse', { device: who(v) })}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.amberTint,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 6,
  },
  title: { fontSize: 14, fontWeight: '600', color: colors.amber },
  row: { gap: 2 },
  who: { fontSize: 12, color: colors.textMuted },
  value: { fontSize: 15, color: colors.text },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
  button: {
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  buttonText: { fontSize: 14, fontWeight: '600', color: colors.amber },
});
