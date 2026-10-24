import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CalcField } from '../useCalcField';
import { useT } from '../../../i18n';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';

export function yearsMonths(
  t: ReturnType<typeof useT>,
  months: number,
): string {
  return t('canadaPurchase.yearsMonths', {
    years: Math.floor(months / 12),
    months: months % 12,
  });
}

export function payoffTime(
  t: ReturnType<typeof useT>,
  plan: { months: number; paysOff: boolean },
): string {
  return plan.paysOff
    ? yearsMonths(t, plan.months)
    : t('mortgagePlan.neverPaysOff');
}

// "800000" → "800,000" as it is typed; the field parses separators back out.
export function withThousands(text: string): string {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
}

export function parseMap<K extends string | number>(
  json: string,
): Record<K, number> {
  try {
    return JSON.parse(json);
  } catch {
    return {} as Record<K, number>;
  }
}

// A result card that opens on tap; its headline figure shows while closed,
// or "Add" while there's nothing to show yet.
export function Section({
  title,
  summary,
  children,
  defaultOpen,
}: {
  title: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHead} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text
          style={[styles.sectionSummary, !summary && styles.sectionAdd]}
          numberOfLines={1}
        >
          {summary || t('mortgagePlan.sectionAdd')}
        </Text>
        <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

export function Chips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.toggles}>
      {options.map((o) => (
        <Toggle
          key={o.value}
          label={o.label}
          on={value === o.value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </View>
  );
}

export function YearChoice({
  label,
  field,
  years,
  hint,
}: {
  label: string;
  field: CalcField;
  years: number[];
  hint?: string;
}) {
  const t = useT();
  return (
    <View style={styles.choice}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.toggles}>
        {years.map((y) => (
          <Toggle
            key={y}
            label={t('mortgagePlan.foldYears', { years: y })}
            on={field.number === y}
            onPress={() => field.set(String(y))}
          />
        ))}
      </View>
      {hint ? <Text style={text.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Toggle({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.toggle, on && styles.toggleOn]} onPress={onPress}>
      <Text style={[styles.toggleText, on && styles.toggleTextOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

export const text = StyleSheet.create({
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  warn: { fontSize: 12, color: colors.negative },
  link: { color: colors.accent, fontWeight: '700' },
  subheading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
});

export const toggleRow = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});

const styles = StyleSheet.create({
  choice: { gap: spacing.xs },
  choiceLabel: { fontSize: 14, color: colors.textMuted },
  toggles: toggleRow.row,
  toggle: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  toggleOn: { borderColor: colors.accent, backgroundColor: colors.tint },
  toggleText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  toggleTextOn: { color: colors.accent },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  sectionSummary: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  sectionAdd: { color: colors.accent },
  chevron: { fontSize: 20, color: colors.textMuted },
  chevronOpen: { transform: [{ rotate: '90deg' }], color: colors.accent },
  sectionBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
});
