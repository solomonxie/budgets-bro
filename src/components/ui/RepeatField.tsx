import { useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomSheet } from './BottomSheet';
import { ExpandedPanel, useExpandingField } from './ExpandingField';
import { NumberWheel } from './NumberWheel';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { formatWeekdayShort } from '../../domain/month';
import type {
  RecurrenceRule,
  ScheduleFrequency,
} from '../../domain/recurrence';

const FREQUENCIES: ScheduleFrequency[] = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
];
const FREQUENCY_LABEL_KEY: Record<ScheduleFrequency, TranslationKey> = {
  daily: 'repeatField.frequencyDaily',
  weekly: 'repeatField.frequencyWeekly',
  monthly: 'repeatField.frequencyMonthly',
  yearly: 'repeatField.frequencyYearly',
};
const UNIT_LABEL_KEY: Record<
  ScheduleFrequency,
  { one: TranslationKey; many: TranslationKey }
> = {
  daily: { one: 'repeatField.unitDay', many: 'repeatField.unitDays' },
  weekly: { one: 'repeatField.unitWeek', many: 'repeatField.unitWeeks' },
  monthly: { one: 'repeatField.unitMonth', many: 'repeatField.unitMonths' },
  yearly: { one: 'repeatField.unitYear', many: 'repeatField.unitYears' },
};
const MAX_INTERVAL = 99;
const WEEKDAY_INDICES = [0, 1, 2, 3, 4, 5, 6];

function weekdayOfDate(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Closed-field label — always "Every {n} {unit}" (+ "on Mon, Thu…" once
// specific weekdays are picked), no preset shortcuts to fall back to.
function describeRule(
  rule: RecurrenceRule,
  t: ReturnType<typeof useI18n>['t'],
  locale: string,
): string {
  const unit = t(
    rule.intervalN === 1
      ? UNIT_LABEL_KEY[rule.frequency].one
      : UNIT_LABEL_KEY[rule.frequency].many,
  );
  if (rule.frequency === 'weekly' && rule.daysOfWeekMask) {
    const days = WEEKDAY_INDICES.filter(
      (i) => (rule.daysOfWeekMask! & (1 << i)) !== 0,
    )
      .map((i) => formatWeekdayShort(i, locale))
      .join(', ');
    return t('repeatField.everyWithDays', { n: rule.intervalN, unit, days });
  }
  return t('repeatField.every', { n: rule.intervalN, unit });
}

interface RepeatFieldProps {
  label: string;
  rule: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
  // Seeds the weekday toggled on by default the first time the picker
  // opens with no days picked yet — a bare "Weekly" defaults to whatever
  // weekday the schedule's own start date falls on, rather than forcing
  // a pick.
  startDate: string;
}

// Frequency + "every N" + (for Weekly) a weekday multi-select — shown
// directly, no preset list to click through first (see domain/recurrence.ts
// for the math these combinations feed).
export function RepeatField({
  label,
  rule,
  onChange,
  startDate,
}: RepeatFieldProps) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  // Local draft so edits only commit on "Done" — cancelling (backdrop tap)
  // leaves the caller's rule untouched. Unfolded in place there is nothing
  // to cancel and no Done to press, so edits go straight through.
  const [draft, setDraft] = useState<RecurrenceRule>(rule);
  const inline = useExpandingField();
  const edited = inline ? rule : draft;

  const openPicker = () => {
    // Same reasoning as DropdownField/DateField's own dismiss-before-open.
    Keyboard.dismiss();
    if (inline) {
      inline.toggle();
      return;
    }
    setDraft(rule);
    setOpen(true);
  };
  const close = () => setOpen(false);

  const update = (patch: (d: RecurrenceRule) => RecurrenceRule) => {
    const next = patch(edited);
    if (inline) onChange(next);
    else setDraft(next);
  };

  const setFrequency = (frequency: ScheduleFrequency) => {
    update((d) => ({
      ...d,
      frequency,
      daysOfWeekMask:
        frequency === 'weekly'
          ? (d.daysOfWeekMask ?? 1 << weekdayOfDate(startDate))
          : null,
    }));
  };

  const toggleWeekday = (i: number) => {
    update((d) => {
      const mask = d.daysOfWeekMask ?? 1 << weekdayOfDate(startDate);
      const next = mask ^ (1 << i);
      return { ...d, daysOfWeekMask: next === 0 ? mask : next }; // never let every day be unchecked
    });
  };

  const confirm = () => {
    onChange(draft);
    close();
  };

  const editor = (
    <>
      <Text style={styles.sectionLabel}>{t('repeatField.frequencyLabel')}</Text>
      <View style={styles.segmented}>
        {FREQUENCIES.map((f) => (
          <Pressable
            key={f}
            style={[
              styles.segment,
              edited.frequency === f && styles.segmentActive,
            ]}
            onPress={() => setFrequency(f)}
          >
            <Text
              style={[
                styles.segmentText,
                edited.frequency === f && styles.segmentTextActive,
              ]}
            >
              {t(FREQUENCY_LABEL_KEY[f])}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>{t('repeatField.everyLabel')}</Text>
      <View style={styles.everyRow}>
        <NumberWheel
          label={t('repeatField.everyLabel')}
          value={edited.intervalN}
          onChange={(n) => update((d) => ({ ...d, intervalN: n }))}
          min={1}
          max={MAX_INTERVAL}
        />
        <Text style={styles.everyUnit}>
          {t(
            edited.intervalN === 1
              ? UNIT_LABEL_KEY[edited.frequency].one
              : UNIT_LABEL_KEY[edited.frequency].many,
          )}
        </Text>
      </View>

      {edited.frequency === 'weekly' ? (
        <>
          <Text style={styles.sectionLabel}>
            {t('repeatField.onDaysLabel')}
          </Text>
          <View style={styles.weekdayRow}>
            {WEEKDAY_INDICES.map((i) => {
              const mask =
                edited.daysOfWeekMask ?? 1 << weekdayOfDate(startDate);
              const selected = (mask & (1 << i)) !== 0;
              return (
                <Pressable
                  key={i}
                  style={[
                    styles.weekdayChip,
                    selected && styles.weekdayChipSelected,
                  ]}
                  onPress={() => toggleWeekday(i)}
                >
                  <Text
                    style={[
                      styles.weekdayChipText,
                      selected && styles.weekdayChipTextSelected,
                    ]}
                  >
                    {formatWeekdayShort(i, language)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </>
  );

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={openPicker}>
        <Text style={styles.valueText}>{describeRule(rule, t, language)}</Text>
        <Text style={styles.chevron}>{inline?.expanded ? '▴' : '▾'}</Text>
      </Pressable>
      {inline ? (
        inline.expanded ? (
          <ExpandedPanel scroll={false}>{editor}</ExpandedPanel>
        ) : null
      ) : (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={close}
        >
          <BottomSheet title={t('repeatField.title')} onClose={close}>
            {editor}
            <Pressable style={styles.doneButton} onPress={confirm}>
              <Text style={styles.doneButtonText}>{t('common.done')}</Text>
            </Pressable>
          </BottomSheet>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  valueText: { fontSize: 15, color: colors.text, flex: 1 },
  chevron: { color: colors.textMuted, fontSize: 13, marginLeft: spacing.sm },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
  everyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  everyUnit: { fontSize: 15, color: colors.text },
  weekdayRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  weekdayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  weekdayChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  weekdayChipTextSelected: { color: '#fff' },
  doneButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  doneButtonText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
});
