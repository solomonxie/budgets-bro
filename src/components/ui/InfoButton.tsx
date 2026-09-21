import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CardModal } from './CardModal';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// A section heading's "ⓘ" — the long explanation a section deserves but
// shouldn't spend permanent screen space on, one tap away and never in the
// way of the switches it explains.
export function InfoButton({
  title,
  paragraphs,
  closeLabel,
}: {
  title: string;
  paragraphs: string[];
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable hitSlop={10} onPress={() => setOpen(true)}>
        <Text style={styles.icon}>ⓘ</Text>
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
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  closeRow: { alignItems: 'flex-end', paddingTop: spacing.xs },
  closeText: { fontSize: 15, fontWeight: '700', color: colors.accent },
});
