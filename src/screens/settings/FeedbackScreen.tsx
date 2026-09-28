import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import {
  FEEDBACK_STATUSES,
  newestFirst,
  readFeedback,
  updateFeedback,
  withAdded,
  withRemoved,
  withStatus,
} from '../../feedback/feedbackLog';
import type { FeedbackFile, FeedbackItem, FeedbackStatus } from '../../feedback/feedbackLog';
import { localeTag, useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const STATUS_LABELS: Record<FeedbackStatus, TranslationKey> = {
  open: 'feedback.statusOpen',
  in_progress: 'feedback.statusInProgress',
  done: 'feedback.statusDone',
  wontfix: 'feedback.statusWontfix',
};

const STATUS_COLORS: Record<FeedbackStatus, { bg: string; fg: string }> = {
  open: { bg: colors.amberTint, fg: colors.amber },
  in_progress: { bg: colors.tint, fg: colors.accent },
  done: { bg: colors.positiveTint, fg: colors.positive },
  wontfix: { bg: colors.border, fg: colors.textMuted },
};

export function FeedbackScreen() {
  const { t, language } = useI18n();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    async (change: (file: FeedbackFile) => FeedbackFile) => {
      try {
        setItems((await updateFeedback(change)).items);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      readFeedback()
        .then((file) => {
          setItems(file.items);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }, []),
  );

  const sorted = useMemo(() => newestFirst(items), [items]);

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    await apply((file) => withAdded(file, text));
    setDraft('');
  };

  const pickStatus = (item: FeedbackItem) => {
    Alert.alert(t('feedback.statusTitle'), undefined, [
      ...FEEDBACK_STATUSES.map((status) => ({
        text: t(STATUS_LABELS[status]),
        onPress: () => apply((file) => withStatus(file, item.id, status)),
      })),
      { text: t('common.delete'), style: 'destructive' as const, onPress: () => confirmDelete(item) },
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  const confirmDelete = (item: FeedbackItem) => {
    Alert.alert(t('feedback.deleteTitle'), item.text, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => apply((file) => withRemoved(file, item.id)),
      },
    ]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(localeTag(language), { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <ScreenContainer scroll modal>
      <View style={styles.section}>
        <TextField
          multiline
          value={draft}
          onChangeText={setDraft}
          placeholder={t('feedback.placeholder')}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!draft.trim()}
          onPress={add}
          style={styles.addLink}
        >
          <Text style={[styles.addLinkText, !draft.trim() && styles.dimmed]}>
            {t('feedback.add')}
          </Text>
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {sorted.length === 0 ? (
        <Text style={styles.empty}>{t('feedback.empty')}</Text>
      ) : (
        <View style={styles.group}>
          {sorted.map((item, i) => {
            const status = STATUS_COLORS[item.status] ?? STATUS_COLORS.open;
            return (
              <Pressable
                key={item.id}
                onLongPress={() => confirmDelete(item)}
                style={[styles.row, i > 0 && styles.rowDivider]}
              >
                <Text style={styles.text}>{item.text}</Text>
                {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                <View style={styles.meta}>
                  <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => pickStatus(item)}
                    hitSlop={8}
                    style={[styles.chip, { backgroundColor: status.bg }]}
                  >
                    <Text style={[styles.chipText, { color: status.fg }]}>
                      {STATUS_LABELS[item.status] ? t(STATUS_LABELS[item.status]) : item.status}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      {sorted.length > 0 ? <Text style={styles.hint}>{t('feedback.deleteHint')}</Text> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs, marginBottom: spacing.md },
  input: { minHeight: 88, textAlignVertical: 'top' },
  addLink: { alignItems: 'center', paddingVertical: spacing.sm },
  addLinkText: { color: colors.accent, fontWeight: '700' },
  dimmed: { opacity: 0.4 },
  errorText: { color: colors.negative, fontSize: 13 },
  empty: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: { padding: spacing.md, gap: spacing.xs },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  note: { fontSize: 13, color: colors.textMuted, lineHeight: 18, fontStyle: 'italic' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  date: { fontSize: 12, color: colors.textMuted },
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '700' },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});
