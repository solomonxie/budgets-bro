import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { openCount, readFeedback } from '../../feedback/feedbackLog';
import type { RootStackParamList } from '../../navigation/types';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function FeedbackSection() {
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [open, setOpen] = useState(0);

  useFocusEffect(
    useCallback(() => {
      readFeedback()
        .then((file) => setOpen(openCount(file.items)))
        .catch(() => setOpen(0));
    }, []),
  );

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('feedback.title')}</Text>
      <View style={styles.group}>
        <Pressable style={styles.row} onPress={() => navigation.navigate('Feedback')}>
          <View style={styles.rowMain}>
            <Text style={styles.rowLabel}>{t('feedback.title')}</Text>
            <Text style={styles.rowHint}>{t('feedback.rowHint')}</Text>
          </View>
          {open > 0 ? <Text style={styles.count}>{t('feedback.openCount', { count: open })}</Text> : null}
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs, marginBottom: spacing.md },
  heading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  rowMain: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowHint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  count: { fontSize: 13, color: colors.textMuted },
  chevron: { fontSize: 18, color: colors.textMuted },
});
