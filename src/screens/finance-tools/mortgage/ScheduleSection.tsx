import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatMoney } from '../../../domain/money';
import {
  monthAt,
  plannedExtraAt,
  recurringAt,
} from '../../../finance-tools/mortgagePlan';
import type { ScheduleRow } from '../../../finance-tools/mortgagePlan';
import { localeTag, useI18n } from '../../../i18n';
import { formatMonthShort } from '../../../domain/month';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';

interface Year {
  year: number;
  rows: ScheduleRow[];
  past: boolean;
  principalCents: number;
  interestCents: number;
  extraCents: number;
  endBalanceCents: number;
}

// Calendar years: row 1 is `firstMonth`, so the first and last years are
// usually partial.
function byYear(
  rows: ScheduleRow[],
  pastCount: number,
  firstMonth: string,
): Year[] {
  const years: Year[] = [];
  for (const row of rows) {
    const year = Number(monthAt(firstMonth, row.month).slice(0, 4));
    let y = years[years.length - 1];
    if (!y || y.year !== year) {
      y = {
        year,
        rows: [],
        past: true,
        principalCents: 0,
        interestCents: 0,
        extraCents: 0,
        endBalanceCents: 0,
      };
      years.push(y);
    }
    y.rows.push(row);
    if (row.month > pastCount) y.past = false;
    y.principalCents += row.principalCents + row.extraCents;
    y.interestCents += row.interestCents;
    y.extraCents += row.extraCents;
    y.endBalanceCents = row.balanceCents;
  }
  return years;
}

// Every payment, a year per row so 300 months stay readable; open a year for
// its months, tap a month to put an extra payment there. The rest of the
// schedule re-runs from that month on. Payments already made (`pastRows`)
// come first, greyed, and can't be planned. Lumps stay keyed by the month
// counted from today.
export interface Extras {
  lumps: Record<number, number>;
  recurring: Record<number, number>;
}

function shift(map: Record<number, number>, by: number) {
  const out: Record<number, number> = {};
  for (const [m, c] of Object.entries(map)) out[Number(m) + by] = c;
  return out;
}

export function ScheduleSection({
  rows: upcoming,
  pastRows = [],
  firstMonth,
  extras: upcomingExtras,
  onChangeExtras,
}: {
  rows: ScheduleRow[];
  pastRows?: ScheduleRow[];
  /** 'YYYY-MM' of the first row shown. */
  firstMonth: string;
  extras: Extras;
  onChangeExtras: (next: Extras) => void;
}) {
  const { t, language } = useI18n();
  const locale = localeTag(language);
  const monthLabel = (month: number) => {
    const ym = monthAt(firstMonth, month);
    return `${formatMonthShort(ym, locale)} ${ym.slice(0, 4)}`;
  };
  const pastCount = pastRows.length;
  const rows = useMemo(
    () => [
      ...pastRows,
      ...upcoming.map((row) => ({ ...row, month: row.month + pastCount })),
    ],
    [pastRows, upcoming, pastCount],
  );
  const extras = useMemo<Extras>(
    () => ({
      lumps: shift(upcomingExtras.lumps, pastCount),
      recurring: shift(upcomingExtras.recurring, pastCount),
    }),
    [upcomingExtras, pastCount],
  );
  const commit = (next: Extras) => {
    onChangeExtras({
      lumps: shift(next.lumps, -pastCount),
      recurring: shift(next.recurring, -pastCount),
    });
    setEditing(null);
  };
  const years = useMemo(
    () => byYear(rows, pastCount, firstMonth),
    [rows, pastCount, firstMonth],
  );
  // Opens on the year of the next payment, which is marked.
  const nextRow = pastCount + 1;
  const [openYear, setOpenYear] = useState<number | null>(() =>
    Number(monthAt(firstMonth, nextRow).slice(0, 4)),
  );
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const planned = (month: number) =>
    plannedExtraAt({ monthlyCents: 0, yearlyCents: 0, ...extras }, month);
  const draftCents = () => Number(draft.replace(/\D/g, '') || 0) * 100;

  const startEdit = (month: number) => {
    setEditing(month);
    const cents = planned(month);
    setDraft(cents > 0 ? withThousands(String(Math.round(cents / 100))) : '');
  };
  const thisMonthOnly = (month: number) => {
    const lumps = { ...extras.lumps };
    const cents = draftCents();
    if (cents === recurringAt(extras.recurring, month)) delete lumps[month];
    else lumps[month] = cents;
    commit({ ...extras, lumps });
  };
  const everyMonth = (month: number) => {
    const lumps = { ...extras.lumps };
    delete lumps[month];
    commit({
      lumps,
      recurring: { ...extras.recurring, [month]: draftCents() },
    });
  };
  const hasExtrasFrom = (month: number) =>
    recurringAt(extras.recurring, month) > 0 ||
    [...Object.entries(extras.lumps), ...Object.entries(extras.recurring)].some(
      ([m, c]) => Number(m) >= month && c > 0,
    );
  const removeFrom = (month: number) => {
    const keep = (map: Record<number, number>) =>
      Object.fromEntries(
        Object.entries(map).filter(([m]) => Number(m) < month),
      ) as Record<number, number>;
    const recurring = keep(extras.recurring);
    if (recurringAt(recurring, month) > 0) recurring[month] = 0;
    commit({ lumps: keep(extras.lumps), recurring });
  };

  // Every planned extra in one list, so none has to be hunted for by year.
  const plannedList = useMemo(() => {
    const starts = Object.keys(extras.recurring)
      .map(Number)
      .sort((a, b) => a - b);
    const items: {
      key: string;
      month: number;
      text: string;
      remove: () => void;
    }[] = [];
    starts.forEach((start, i) => {
      const cents = extras.recurring[start];
      if (cents <= 0 || start > rows.length) return;
      const end = starts[i + 1];
      items.push({
        key: `r${start}`,
        month: start,
        text:
          end != null
            ? t('mortgagePlan.plannedEveryMonthUntil', {
                amount: formatMoney(cents),
                from: monthLabel(start),
                until: monthLabel(end - 1),
              })
            : t('mortgagePlan.plannedEveryMonth', {
                amount: formatMoney(cents),
                from: monthLabel(start),
              }),
        remove: () => {
          const recurring = { ...extras.recurring };
          delete recurring[start];
          commit({ ...extras, recurring });
        },
      });
    });
    Object.entries(extras.lumps).forEach(([m, cents]) => {
      const month = Number(m);
      if (month > rows.length) return;
      items.push({
        key: `l${month}`,
        month,
        text:
          cents > 0
            ? t('mortgagePlan.plannedOnce', {
                amount: formatMoney(cents),
                month: monthLabel(month),
              })
            : t('mortgagePlan.plannedSkipped', { month: monthLabel(month) }),
        remove: () => {
          const lumps = { ...extras.lumps };
          delete lumps[month];
          commit({ ...extras, lumps });
        },
      });
    });
    return items.sort((a, b) => a.month - b.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extras, rows.length, firstMonth, locale]);

  const openMonth = (month: number) => {
    setOpenYear(Number(monthAt(firstMonth, month).slice(0, 4)));
    startEdit(month);
  };

  return (
    <View style={styles.wrap}>
      {plannedList.length > 0 ? (
        <View style={styles.planned}>
          <Text style={styles.plannedHeading}>
            {t('mortgagePlan.plannedHeading')}
          </Text>
          {plannedList.map((item) => (
            <View key={item.key} style={styles.plannedRow}>
              <Pressable
                style={styles.plannedText}
                onPress={() => openMonth(item.month)}
              >
                <Text style={styles.plannedLabel}>{item.text}</Text>
              </Pressable>
              <Pressable
                hitSlop={10}
                onPress={item.remove}
                accessibilityLabel={t('common.delete')}
              >
                <Text style={styles.plannedRemove}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.headRow}>
        <Text style={[styles.cell, styles.cellWide, styles.head]}>
          {t('mortgagePlan.colWhen')}
        </Text>
        <Text style={[styles.cell, styles.head]}>
          {t('mortgagePlan.colPrincipal')}
        </Text>
        <Text style={[styles.cell, styles.head]}>
          {t('mortgagePlan.colInterest')}
        </Text>
        <Text style={[styles.cell, styles.head]}>
          {t('mortgagePlan.colBalance')}
        </Text>
      </View>
      {years.map((y) => {
        const open = openYear === y.year;
        return (
          <View key={y.year}>
            <Pressable
              style={({ pressed }) => [
                styles.row,
                styles.yearRow,
                y.past && styles.past,
                pressed && styles.pressed,
              ]}
              onPress={() => setOpenYear(open ? null : y.year)}
            >
              <Text style={[styles.cell, styles.cellWide, styles.yearLabel]}>
                {open ? '▾ ' : '› '}
                {y.year}
                {y.extraCents > 0 ? ' ●' : ''}
              </Text>
              <Text style={styles.cell}>{formatMoney(y.principalCents)}</Text>
              <Text style={[styles.cell, styles.interest]}>
                {formatMoney(y.interestCents)}
              </Text>
              <Text style={styles.cell}>{formatMoney(y.endBalanceCents)}</Text>
            </Pressable>
            {open
              ? y.rows.map((row) => (
                  <View key={row.month}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.row,
                        row.month <= pastCount && styles.past,
                        row.month === nextRow && styles.nextRow,
                        pressed && styles.pressed,
                      ]}
                      disabled={row.month <= pastCount}
                      onPress={() =>
                        editing === row.month
                          ? setEditing(null)
                          : startEdit(row.month)
                      }
                    >
                      <Text
                        style={[styles.cell, styles.cellWide, styles.month]}
                      >
                        {monthLabel(row.month)}
                        {row.month === nextRow
                          ? ` · ${t('mortgagePlan.nextPayment')}`
                          : ''}
                        {row.month > pastCount &&
                        extras.lumps[row.month] == null &&
                        recurringAt(extras.recurring, row.month) > 0
                          ? ' ↻'
                          : ''}
                      </Text>
                      <Text style={styles.cell}>
                        {formatMoney(row.principalCents)}
                        {row.extraCents > 0 ? (
                          <Text
                            style={styles.extra}
                          >{`\n+${formatMoney(row.extraCents)}`}</Text>
                        ) : null}
                      </Text>
                      <Text style={[styles.cell, styles.interest]}>
                        {formatMoney(row.interestCents)}
                      </Text>
                      <Text style={styles.cell}>
                        {formatMoney(row.balanceCents)}
                      </Text>
                    </Pressable>
                    {editing === row.month ? (
                      <View style={styles.editor}>
                        <Text style={styles.editorLabel}>
                          {t('mortgagePlan.extraThisMonth', {
                            month: monthLabel(row.month),
                          })}
                        </Text>
                        <View style={styles.editorRow}>
                          <Text style={styles.dollar}>$</Text>
                          <TextInput
                            style={styles.input}
                            value={draft}
                            onChangeText={(text) =>
                              setDraft(withThousands(text))
                            }
                            keyboardType="number-pad"
                            keyboardAppearance="dark"
                            placeholder="10,000"
                            placeholderTextColor={colors.textMuted}
                            autoFocus
                          />
                        </View>
                        <View style={styles.buttons}>
                          <EditorButton
                            label={t('mortgagePlan.thisMonthOnly')}
                            onPress={() => thisMonthOnly(row.month)}
                          />
                          <EditorButton
                            label={t('mortgagePlan.everyMonthFromHere')}
                            onPress={() => everyMonth(row.month)}
                            primary
                          />
                        </View>
                        <View style={styles.buttons}>
                          {hasExtrasFrom(row.month) ? (
                            <EditorButton
                              label={t('mortgagePlan.removeFromHere')}
                              onPress={() => removeFrom(row.month)}
                              destructive
                            />
                          ) : null}
                          <EditorButton
                            label={t('common.cancel')}
                            onPress={() => setEditing(null)}
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>
                ))
              : null}
          </View>
        );
      })}
    </View>
  );
}

function EditorButton({
  label,
  onPress,
  primary,
  destructive,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.buttonText,
          primary && styles.buttonTextPrimary,
          destructive && styles.buttonTextDestructive,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </Pressable>
  );
}

function withThousands(text: string): string {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  headRow: {
    flexDirection: 'row',
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  head: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  yearRow: { paddingVertical: 10 },
  pressed: { backgroundColor: colors.background },
  past: { opacity: 0.4 },
  nextRow: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingLeft: spacing.xs,
  },
  planned: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  plannedHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  plannedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  plannedText: { flex: 1 },
  plannedLabel: { fontSize: 13, color: colors.positive },
  plannedRemove: { fontSize: 14, color: colors.textMuted },
  cell: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  cellWide: { flex: 1.1, textAlign: 'left' },
  yearLabel: { fontSize: 13, fontWeight: '600' },
  month: { color: colors.textMuted, paddingLeft: spacing.md },
  interest: { color: colors.negative },
  extra: { color: colors.positive, fontSize: 11 },
  editor: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    gap: spacing.xs,
  },
  editorLabel: { fontSize: 12, color: colors.textMuted },
  editorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dollar: { fontSize: 18, color: colors.textMuted },
  input: { flex: 1, fontSize: 18, color: colors.text, paddingVertical: 4 },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.xs,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  buttonPressed: { opacity: 0.7 },
  buttonText: { fontSize: 13, fontWeight: '600', color: colors.text },
  buttonTextPrimary: { color: colors.background, fontWeight: '700' },
  buttonTextDestructive: { color: colors.negative },
});
