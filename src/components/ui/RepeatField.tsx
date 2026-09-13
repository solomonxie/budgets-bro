import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { formatWeekdayShort } from '../../domain/month';
import { RECURRENCE_PRESET_KEYS, matchPreset, ruleForPreset } from '../../domain/recurrence';
import type { RecurrencePresetKey, RecurrenceRule, ScheduleFrequency } from '../../domain/recurrence';

const PRESET_LABEL_KEY: Record<RecurrencePresetKey, TranslationKey> = {
  daily: 'repeatField.presetDaily',
  weekdays: 'repeatField.presetWeekdays',
  weekends: 'repeatField.presetWeekends',
  weekly: 'repeatField.presetWeekly',
  biweekly: 'repeatField.presetBiweekly',
  monthly: 'repeatField.presetMonthly',
  every3Months: 'repeatField.presetEvery3Months',
  every6Months: 'repeatField.presetEvery6Months',
  yearly: 'repeatField.presetYearly',
};

const CUSTOM_FREQUENCIES: ScheduleFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
const FREQUENCY_LABEL_KEY: Record<ScheduleFrequency, TranslationKey> = {
  daily: 'repeatField.frequencyDaily',
  weekly: 'repeatField.frequencyWeekly',
  monthly: 'repeatField.frequencyMonthly',
  yearly: 'repeatField.frequencyYearly',
};
const UNIT_LABEL_KEY: Record<ScheduleFrequency, { one: TranslationKey; many: TranslationKey }> = {
  daily: { one: 'repeatField.unitDay', many: 'repeatField.unitDays' },
  weekly: { one: 'repeatField.unitWeek', many: 'repeatField.unitWeeks' },
  monthly: { one: 'repeatField.unitMonth', many: 'repeatField.unitMonths' },
  yearly: { one: 'repeatField.unitYear', many: 'repeatField.unitYears' },
};

const WEEKDAY_INDICES = [0, 1, 2, 3, 4, 5, 6];

function weekdayOfDate(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Closed-field label: a matching preset's own name, or "Every {n} {unit}"
// (plus "on Mon, Thu…" once specific weekdays are picked) for anything
// that doesn't match one — see domain/recurrence.ts's matchPreset.
function describeRule(rule: RecurrenceRule, t: ReturnType<typeof useI18n>['t'], locale: string): string {
  const preset = matchPreset(rule);
  if (preset) return t(PRESET_LABEL_KEY[preset]);
  const unit = t(rule.intervalN === 1 ? UNIT_LABEL_KEY[rule.frequency].one : UNIT_LABEL_KEY[rule.frequency].many);
  if (rule.frequency === 'weekly' && rule.daysOfWeekMask) {
    const days = WEEKDAY_INDICES.filter((i) => (rule.daysOfWeekMask! & (1 << i)) !== 0)
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
  // Seeds the weekday toggled on by default the first time Custom opens
  // with no days picked yet — a bare "Weekly" defaults to whatever weekday
  // the schedule's own start date falls on, same as before this field
  // existed, rather than forcing a pick.
  startDate: string;
}

// Apple Reminders-style repeat picker: a flat list of common presets
// (Daily/Weekdays/Weekends/Weekly/Biweekly/Monthly/…/Yearly) plus a
// "Custom" row that drops into frequency + "every N" + (for Weekly) a
// weekday multi-select — see domain/recurrence.ts for the math those
// combinations feed.
export function RepeatField({ label, rule, onChange, startDate }: RepeatFieldProps) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'presets' | 'custom'>('presets');
  // Local draft so Custom's Frequency/Every/weekday edits only commit on
  // "Done" — cancelling (backdrop tap) leaves the caller's rule untouched.
  const [draft, setDraft] = useState<RecurrenceRule>(rule);

  const openPicker = () => {
    setDraft(rule);
    setView('presets');
    setOpen(true);
  };
  const close = () => setOpen(false);

  const pickPreset = (key: RecurrencePresetKey) => {
    onChange(ruleForPreset(key));
    close();
  };

  const openCustom = () => {
    setDraft(rule);
    setView('custom');
  };

  const setCustomFrequency = (frequency: ScheduleFrequency) => {
    setDraft((d) => ({
      ...d,
      frequency,
      daysOfWeekMask: frequency === 'weekly' ? (d.daysOfWeekMask ?? 1 << weekdayOfDate(startDate)) : null,
    }));
  };

  const toggleWeekday = (i: number) => {
    setDraft((d) => {
      const current = d.daysOfWeekMask ?? 1 << weekdayOfDate(startDate);
      const next = current ^ (1 << i);
      return { ...d, daysOfWeekMask: next === 0 ? current : next }; // never let every day be unchecked
    });
  };

  const confirmCustom = () => {
    onChange(draft);
    close();
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={openPicker}>
        <Text style={styles.valueText}>{describeRule(rule, t, language)}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <BottomSheet title={view === 'presets' ? t('repeatField.title') : t('repeatField.customTitle')} onClose={close}>
          {view === 'presets' ? (
            <>
              {RECURRENCE_PRESET_KEYS.map((key) => (
                <Pressable key={key} style={styles.option} onPress={() => pickPreset(key)}>
                  <Text style={[styles.optionText, matchPreset(rule) === key && styles.optionTextSelected]}>
                    {t(PRESET_LABEL_KEY[key])}
                  </Text>
                  {matchPreset(rule) === key ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              ))}
              <Pressable style={styles.option} onPress={openCustom}>
                <Text style={styles.optionText}>{t('repeatField.custom')}</Text>
                <Text style={styles.chevronInline}>›</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>{t('repeatField.frequencyLabel')}</Text>
              <View style={styles.segmented}>
                {CUSTOM_FREQUENCIES.map((f) => (
                  <Pressable
                    key={f}
                    style={[styles.segment, draft.frequency === f && styles.segmentActive]}
                    onPress={() => setCustomFrequency(f)}
                  >
                    <Text style={[styles.segmentText, draft.frequency === f && styles.segmentTextActive]}>
                      {t(FREQUENCY_LABEL_KEY[f])}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.sectionLabel}>{t('repeatField.everyLabel')}</Text>
              <View style={styles.everyRow}>
                <TextInput
                  style={styles.everyInput}
                  keyboardType="number-pad"
                  value={String(draft.intervalN)}
                  onChangeText={(v) => setDraft((d) => ({ ...d, intervalN: Math.max(1, Math.round(parseFloat(v) || 1)) }))}
                />
                <Text style={styles.everyUnit}>
                  {t(draft.intervalN === 1 ? UNIT_LABEL_KEY[draft.frequency].one : UNIT_LABEL_KEY[draft.frequency].many)}
                </Text>
              </View>

              {draft.frequency === 'weekly' ? (
                <>
                  <Text style={styles.sectionLabel}>{t('repeatField.onDaysLabel')}</Text>
                  <View style={styles.weekdayRow}>
                    {WEEKDAY_INDICES.map((i) => {
                      const mask = draft.daysOfWeekMask ?? 1 << weekdayOfDate(startDate);
                      const selected = (mask & (1 << i)) !== 0;
                      return (
                        <Pressable key={i} style={[styles.weekdayChip, selected && styles.weekdayChipSelected]} onPress={() => toggleWeekday(i)}>
                          <Text style={[styles.weekdayChipText, selected && styles.weekdayChipTextSelected]}>{formatWeekdayShort(i, language)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Pressable style={styles.doneButton} onPress={confirmCustom}>
                <Text style={styles.doneButtonText}>{t('common.done')}</Text>
              </Pressable>
            </>
          )}
        </BottomSheet>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
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
  chevronInline: { color: colors.textMuted, fontSize: 15 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { fontSize: 15, color: colors.text },
  optionTextSelected: { fontWeight: '700', color: colors.accent },
  check: { color: colors.accent, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: spacing.sm, marginBottom: 6 },
  segmented: { flexDirection: 'row', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
  everyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  everyInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
    width: 64,
    textAlign: 'center',
  },
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
  weekdayChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekdayChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  weekdayChipTextSelected: { color: '#fff' },
  doneButton: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  doneButtonText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
});
