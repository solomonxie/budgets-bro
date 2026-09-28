import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CardModal } from '../../components/ui/CardModal';
import { ChipRow } from '../../components/ui/ChipRow';
import { TextField } from '../../components/ui/TextField';
import { DateField } from '../../components/ui/DateField';
import { getDb } from '../../db/client';
import * as paymentReviewRepo from '../../db/repositories/paymentReviewRepo';
import { ACTION_DECISIONS, defaultDueOn, reviewOnAfterDecision } from '../../domain/paymentReview';
import type { Decision, ReviewItem } from '../../domain/paymentReview';
import { formatDateLabel } from '../../domain/month';
import { useI18n, localeTag } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { useAppStore } from '../../state/useAppStore';
import { colors } from '../../theme/colors';

export const DECISION_LABEL: Record<Decision, TranslationKey> = {
  keep: 'qbr.keep',
  alternative: 'qbr.alternative',
  convert: 'qbr.convert',
  mode: 'qbr.mode',
  cancel: 'qbr.cancel',
  dismiss: 'qbr.dismiss',
  ignore: 'qbr.ignore',
  restore: 'qbr.restore',
};

// What the to-do asks the user to go and do — the app does none of it.
function todoHintKey(item: ReviewItem, decision: Decision): TranslationKey | null {
  switch (decision) {
    case 'alternative':
      return 'qbr.alternativeTodo';
    case 'convert':
      return item.cadence === 'annual' ? 'qbr.convertToMonthlyTodo' : 'qbr.convertToAnnualTodo';
    case 'mode':
      return item.schedule ? 'qbr.toAdHocTodo' : 'qbr.toScheduleTodo';
    case 'cancel':
      return 'qbr.cancelTodo';
    default:
      return null;
  }
}

export function PaymentDecisionModal({ item, today, onClose }: { item: ReviewItem | null; today: string; onClose: () => void }) {
  const { t, language } = useI18n();
  const locale = localeTag(language);
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const [decision, setDecision] = useState<Decision>('keep');
  const [note, setNote] = useState('');
  const [dueOn, setDueOn] = useState(today);

  useEffect(() => {
    if (!item) return;
    setDecision(item.ignored ? 'restore' : 'keep');
    setNote('');
  }, [item]);

  useEffect(() => {
    if (item) setDueOn(defaultDueOn(item, decision, today));
  }, [item, decision, today]);

  if (!item) return null;

  const choices: Decision[] = item.ignored
    ? ['restore']
    : [
        'keep',
        'alternative',
        'convert',
        'mode',
        ...(item.detected ? (['dismiss'] as const) : []),
        'ignore',
        'cancel',
      ];
  const isAction = ACTION_DECISIONS.includes(decision);
  const nextReviewOn = reviewOnAfterDecision(today);
  const todoHint = todoHintKey(item, decision);

  const save = async () => {
    const db = await getDb();
    await paymentReviewRepo.decide(db, boardId, item, decision, {
      note: isAction ? note.trim() || null : null,
      dueOn: isAction ? dueOn : null,
      nextReviewOn,
      today,
    });
    bumpDataVersion();
    onClose();
  };

  return (
    <CardModal visible onCancel={onClose}>
      <Text style={styles.title}>{item.name}</Text>
      <ChipRow options={choices.map((d) => ({ value: d, label: t(DECISION_LABEL[d]) }))} value={decision} onChange={setDecision} />
      {decision === 'keep' ? <Text style={styles.hint}>{t('qbr.keepHint', { date: formatDateLabel(nextReviewOn, locale) })}</Text> : null}
      {decision === 'dismiss' ? <Text style={styles.hint}>{t('qbr.dismissHint')}</Text> : null}
      {decision === 'ignore' ? <Text style={styles.hint}>{t('qbr.ignoreHint')}</Text> : null}
      {decision === 'restore' ? <Text style={styles.hint}>{t('qbr.restoreHint')}</Text> : null}
      {isAction ? (
        <>
          {todoHint ? <Text style={styles.todo}>{t(todoHint)}</Text> : null}
          <Text style={styles.hint}>{t('qbr.actionHint')}</Text>
          <DateField label={t('qbr.remindBy')} value={dueOn} onChange={setDueOn} />
          <TextField label={t('qbr.noteLabel')} value={note} onChangeText={setNote} placeholder={t('qbr.notePlaceholder')} />
        </>
      ) : null}
      <View style={styles.actions}>
        <Pressable onPress={onClose}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable style={styles.saveButton} onPress={save}>
          <Text style={styles.saveButtonText}>{t(isAction ? 'qbr.addTodo' : 'common.save')}</Text>
        </Pressable>
      </View>
    </CardModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  todo: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 19 },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 4 },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
