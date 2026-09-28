import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CardModal } from '../../components/ui/CardModal';
import { ChipRow } from '../../components/ui/ChipRow';
import { MoneyField } from '../../components/ui/MoneyField';
import { TextField } from '../../components/ui/TextField';
import { DateField } from '../../components/ui/DateField';
import { getDb } from '../../db/client';
import * as paymentReviewRepo from '../../db/repositories/paymentReviewRepo';
import { addMonths } from '../../finance-tools/amortization';
import {
  ALTERNATIVE_CHECK_DAYS,
  addDays,
  convertedAmountCents,
  convertedFrequency,
  nextMonthlyDateAfter,
  reviewOnAfterKeeping,
} from '../../domain/paymentReview';
import type { ReviewItem, ReviewResolution } from '../../domain/paymentReview';
import type { ScheduleFrequency } from '../../domain/recurrence';
import { formatDateLabel } from '../../domain/month';
import { moneyTextFromDigits, parseMoneyToCents } from '../../domain/money';
import { useI18n, localeTag } from '../../i18n';
import { useAppStore } from '../../state/useAppStore';
import { colors } from '../../theme/colors';

const centsText = (cents: number) =>
  moneyTextFromDigits(String(Math.abs(cents)));

export function PaymentResolutionModal({
  item,
  today,
  onClose,
}: {
  item: ReviewItem | null;
  today: string;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const locale = localeTag(language);
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const [choice, setChoice] = useState<ReviewResolution>('keep');
  const [note, setNote] = useState('');
  const [amountText, setAmountText] = useState('');
  const [nextDate, setNextDate] = useState(today);
  const [refundText, setRefundText] = useState('');
  const [adHocFrequency, setAdHocFrequency] =
    useState<ScheduleFrequency>('monthly');

  const schedule = item?.schedule ?? null;
  const convertTo = schedule ? convertedFrequency(schedule.frequency) : null;

  useEffect(() => {
    if (!item) return;
    setChoice(item.ignored ? 'restore' : 'keep');
    setNote(item.note ?? '');
    setRefundText('');
    setAdHocFrequency('monthly');
    if (item.schedule) {
      setAmountText(
        centsText(
          convertedAmountCents(
            item.schedule.amountCents,
            item.schedule.frequency,
            item.schedule.intervalN,
          ),
        ),
      );
      setNextDate(item.schedule.nextDate);
    } else {
      const annual = item.cadence === 'annual';
      setAdHocFrequency(annual ? 'yearly' : 'monthly');
      setAmountText(centsText(item.amountCents));
      if (item.nextDate && item.nextDate > today) setNextDate(item.nextDate);
      else if (item.lastDate)
        setNextDate(
          annual
            ? addMonths(today, 12)
            : nextMonthlyDateAfter(item.lastDate, today),
        );
      else setNextDate(addMonths(today, 1));
    }
  }, [item, today]);

  if (!item) return null;

  const canChangeMode = schedule ? item.payeeId != null : item.lastDate != null;
  const options: { value: ReviewResolution; label: string }[] = item.ignored
    ? [{ value: 'restore', label: t('abr.restore') }]
    : [
        { value: 'keep', label: t('abr.keep') },
        { value: 'alternative', label: t('abr.alternative') },
        ...(schedule
          ? [{ value: 'convert' as const, label: t('abr.convert') }]
          : []),
        ...(canChangeMode
          ? [{ value: 'mode' as const, label: t('abr.mode') }]
          : []),
        ...(item.detected
          ? [{ value: 'dismiss' as const, label: t('abr.dismiss') }]
          : []),
        ...(item.cadence !== 'adHoc'
          ? [{ value: 'ignore' as const, label: t('abr.ignore') }]
          : []),
        { value: 'cancel', label: t('abr.cancel') },
      ];

  const keepUntil = reviewOnAfterKeeping(
    schedule?.frequency ?? (item.cadence === 'annual' ? 'yearly' : null),
    schedule?.nextDate ?? item.nextDate,
    today,
  );
  const amountCents = parseMoneyToCents(amountText);

  const save = async () => {
    const db = await getDb();
    switch (choice) {
      case 'keep':
        await paymentReviewRepo.setReview(db, item, keepUntil, null);
        break;
      case 'alternative':
        await paymentReviewRepo.setReview(
          db,
          item,
          addDays(today, ALTERNATIVE_CHECK_DAYS),
          note.trim() || null,
        );
        break;
      case 'convert':
        if (!schedule || !convertTo || amountCents <= 0) return;
        await paymentReviewRepo.convertSchedule(
          db,
          schedule.id,
          convertTo,
          amountCents,
          nextDate,
          reviewOnAfterKeeping(convertTo, nextDate, today),
        );
        break;
      case 'mode':
        if (schedule)
          await paymentReviewRepo.scheduleToAdHoc(
            db,
            item,
            addMonths(today, 12),
          );
        else {
          if (amountCents <= 0) return;
          await paymentReviewRepo.toSchedule(
            db,
            boardId,
            item,
            adHocFrequency,
            amountCents,
            nextDate,
            reviewOnAfterKeeping(adHocFrequency, nextDate, today),
          );
        }
        break;
      case 'ignore':
      case 'restore':
        await paymentReviewRepo.setIgnored(db, item, choice === 'ignore');
        break;
      case 'dismiss':
        await paymentReviewRepo.dismiss(db, item, today);
        break;
      case 'cancel':
        await paymentReviewRepo.cancel(
          db,
          boardId,
          item,
          parseMoneyToCents(refundText),
          today,
        );
        break;
    }
    bumpDataVersion();
    onClose();
  };

  return (
    <CardModal visible onCancel={onClose}>
      <Text style={styles.title}>{item.name}</Text>
      <ChipRow options={options} value={choice} onChange={setChoice} />
      {choice === 'keep' ? (
        <Text style={styles.hint}>
          {t('abr.keepHint', { date: formatDateLabel(keepUntil, locale) })}
        </Text>
      ) : null}
      {choice === 'alternative' ? (
        <>
          <Text style={styles.hint}>
            {t('abr.alternativeHint', { days: ALTERNATIVE_CHECK_DAYS })}
          </Text>
          <TextField
            label={t('abr.noteLabel')}
            value={note}
            onChangeText={setNote}
            placeholder={t('abr.notePlaceholder')}
          />
        </>
      ) : null}
      {choice === 'convert' && convertTo ? (
        <>
          <Text style={styles.hint}>
            {t(
              convertTo === 'yearly'
                ? 'abr.convertToAnnualHint'
                : 'abr.convertToMonthlyHint',
            )}
          </Text>
          <MoneyField
            label={t(
              convertTo === 'yearly' ? 'abr.annualPrice' : 'abr.monthlyPrice',
            )}
            value={amountText}
            onChangeText={setAmountText}
          />
          <DateField
            label={t('abr.nextCharge')}
            value={nextDate}
            onChange={setNextDate}
          />
        </>
      ) : null}
      {choice === 'mode' && schedule ? (
        <Text style={styles.hint}>{t('abr.toAdHocHint')}</Text>
      ) : null}
      {choice === 'mode' && !schedule ? (
        <>
          <Text style={styles.hint}>{t('abr.toScheduleHint')}</Text>
          <ChipRow
            options={[
              { value: 'monthly', label: t('abr.monthly') },
              { value: 'yearly', label: t('abr.annual') },
            ]}
            value={adHocFrequency as 'monthly' | 'yearly'}
            onChange={setAdHocFrequency}
          />
          <MoneyField
            label={t('abr.pricePerCharge')}
            value={amountText}
            onChangeText={setAmountText}
          />
          <DateField
            label={t('abr.nextCharge')}
            value={nextDate}
            onChange={setNextDate}
          />
        </>
      ) : null}
      {choice === 'dismiss' ? (
        <Text style={styles.hint}>{t('abr.dismissHint')}</Text>
      ) : null}
      {choice === 'ignore' ? (
        <Text style={styles.hint}>{t('abr.ignoreHint')}</Text>
      ) : null}
      {choice === 'restore' ? (
        <Text style={styles.hint}>{t('abr.restoreHint')}</Text>
      ) : null}
      {choice === 'cancel' ? (
        <>
          <Text style={styles.hint}>
            {t(schedule ? 'abr.cancelScheduleHint' : 'abr.cancelAdHocHint')}
          </Text>
          <MoneyField
            label={t('abr.refund')}
            hint={t('abr.refundHint')}
            value={refundText}
            onChangeText={setRefundText}
            placeholder={t('common.amountPlaceholder')}
          />
        </>
      ) : null}
      <View style={styles.actions}>
        <Pressable onPress={onClose}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.saveButton,
            choice === 'cancel' && styles.dangerButton,
          ]}
          onPress={save}
        >
          <Text style={styles.saveButtonText}>
            {t(choice === 'cancel' ? 'abr.confirmCancel' : 'common.save')}
          </Text>
        </Pressable>
      </View>
    </CardModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dangerButton: { backgroundColor: colors.negative },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
