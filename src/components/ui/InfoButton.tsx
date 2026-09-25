import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CardModal } from './CardModal';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// A section heading's "ⓘ" — the long explanation a section deserves but
// shouldn't spend permanent screen space on, one tap away and never in the
// way of the switches it explains. With `label` it is a text link instead,
// for inside a section already opened — where an icon on the folded row
// was one more thing crowding it.
export function InfoButton({
  title,
  paragraphs,
  closeLabel,
  label,
}: {
  title: string;
  paragraphs: string[];
  closeLabel: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable hitSlop={label ? 4 : 10} onPress={() => setOpen(true)}>
        <Text style={label ? styles.link : styles.icon}>{label ?? 'ⓘ'}</Text>
      </Pressable>
      <CardModal visible={open} onCancel={() => setOpen(false)}>
        <Text style={styles.title}>{title}</Text>
        {paragraphs.map((p) => (
          <Text key={p} style={styles.body}>
            {p}
          </Text>
        ))}
        <View style={styles.closeRow}>
          <Pressable hitSlop={8} onPress={() => setOpen(false)}>
            <Text style={styles.closeText}>{closeLabel}</Text>
          </Pressable>
        </View>
      </CardModal>
    </>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 14, color: colors.textMuted },
  link: { fontSize: 13, fontWeight: '600', color: colors.accent },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  closeRow: { alignItems: 'flex-end', paddingTop: spacing.xs },
  closeText: { fontSize: 15, fontWeight: '700', color: colors.accent },
});
