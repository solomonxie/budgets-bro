import { useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { MovingAverageLine } from '../../components/ui/AverageLine';
import { useChartScrub } from '../../components/ui/chartScrub';
import { InfoButton } from '../../components/ui/InfoButton';
import { useRunway } from '../../hooks/useRunway';
import {
  paycheckToPaycheckCount,
  rollingAverageMonths,
  runwayLevel,
} from '../../domain/runway';
import type { RunwayLevel } from '../../domain/runway';
import { formatMonthShort } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { localeTag, useI18n } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const CHART_HEIGHT = 110;
const MIN_BAR_SLOT = 30;
const BAR_GAP = 2;
const MARKS = [1, 3, 6];
const Y_AXIS_WIDTH = 34;
// A year of runway already says "fine"; past that the bars would only
// flatten every month that matters.
const MAX_SCALE_MONTHS = 12;

// Muted steps from the categorical palette the trends chart uses, so the
// bars sit with the rest of the page instead of shouting over it.
const LEVEL_COLOR: Record<RunwayLevel, string> = {
  paycheck: '#d95926',
  thin: '#c98500',
  covered: '#199e70',
  strong: colors.positive,
};

const LEVEL_KEY = {
  paycheck: 'runway.paycheck',
  thin: 'runway.thin',
  covered: 'runway.covered',
  strong: 'runway.strong',
} as const;

export function RunwayCard({ selectedMonth }: { selectedMonth: string }) {
  const { t, language } = useI18n();
  const points = useRunway();
  const { width: windowWidth } = useWindowDimensions();
  const [index, setIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const fittedWidth = Math.max(
    160,
    windowWidth - spacing.md * 4 - Y_AXIS_WIDTH,
  );
  const chartWidth = Math.max(fittedWidth, points.length * MIN_BAR_SLOT);
  const { scrollEnabled, handlers } = useChartScrub({
    count: points.length,
    chartWidth,
    onSelect: setIndex,
  });

  const header = (
    <View style={styles.titleRow}>
      <Text style={styles.label}>{t('runway.title')}</Text>
      <InfoButton
        title={t('runway.infoTitle')}
        paragraphs={[
          t('runway.infoWhat'),
          t('runway.infoCash'),
          t('runway.infoCost'),
          t('runway.infoLevels'),
        ]}
        closeLabel={t('common.done')}
      />
    </View>
  );

  if (!points.some((p) => p.months != null)) {
    return (
      <View style={styles.card}>
        {header}
        <Text style={styles.empty}>{t('insights.notEnoughHistory')}</Text>
      </View>
    );
  }

  const maxMonths = Math.max(...points.map((p) => p.months ?? 0));
  const scale = Math.min(MAX_SCALE_MONTHS, Math.max(7, maxMonths));
  const y = (months: number) =>
    CHART_HEIGHT - (Math.min(months, scale) / scale) * (CHART_HEIGHT - 6);
  const slot = chartWidth / points.length;
  const barWidth = Math.max(4, slot - BAR_GAP * 2);

  const pinned = points.findIndex((p) => p.month === selectedMonth);
  const active = index ?? (pinned >= 0 ? pinned : points.length - 1);
  const shown = points[active];
  const level = shown.months != null ? runwayLevel(shown.months) : null;
  const paycheckMonths = paycheckToPaycheckCount(points);
  const averages = rollingAverageMonths(points);
  const latestAverage = averages.at(-1) ?? null;
  const marks = MARKS.filter((m) => m <= scale);
  const locale = localeTag(language);

  return (
    <View style={styles.card}>
      {header}
      <View style={styles.headlineRow}>
        <Text style={styles.headline}>
          {shown.months == null
            ? '—'
            : t('runway.months', { count: shown.months.toFixed(1) })}
        </Text>
        {level ? (
          <Text style={[styles.level, { color: LEVEL_COLOR[level] }]}>
            {t(LEVEL_KEY[level])}
          </Text>
        ) : null}
        <Text style={styles.month}>
          {formatMonthShort(shown.month, locale)} ’{shown.month.slice(2, 4)}
        </Text>
      </View>
      <Text style={styles.sub}>
        {t('runway.formula', {
          cash: formatMoney(shown.cashCents),
          cost: formatMoney(shown.avgCostCents),
        })}
      </Text>
      <View style={styles.chartRow}>
        <View style={{ width: Y_AXIS_WIDTH, height: CHART_HEIGHT }}>
          {marks.map((m) => (
            <Text key={m} style={[styles.yLabel, { top: y(m) - 7 }]}>
              {t('runway.markLabel', { count: m })}
            </Text>
          ))}
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          scrollEnabled={scrollEnabled}
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
        >
          <View {...handlers}>
            <Svg width={chartWidth} height={CHART_HEIGHT}>
              {marks.map((m) => (
                <Line
                  key={m}
                  x1={0}
                  y1={y(m)}
                  x2={chartWidth}
                  y2={y(m)}
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              ))}
              {points.map((p, i) => {
                if (p.months == null) return null;
                const top = y(p.months);
                return (
                  <Rect
                    key={p.month}
                    x={i * slot + BAR_GAP}
                    y={top}
                    width={barWidth}
                    height={Math.max(2, CHART_HEIGHT - top)}
                    rx={3}
                    fill={LEVEL_COLOR[runwayLevel(p.months)]}
                    opacity={i === active ? 1 : 0.7}
                  />
                );
              })}
              {latestAverage != null ? (
                <MovingAverageLine
                  points={averages.flatMap((a, i) =>
                    a == null ? [] : [{ x: i * slot + slot / 2, y: y(a) }],
                  )}
                  width={chartWidth}
                  label={t('runway.avgLine', {
                    count: latestAverage.toFixed(1),
                  })}
                />
              ) : null}
            </Svg>
            <View style={{ width: chartWidth, height: 26 }}>
              {points.map((p, i) => (
                <Text
                  key={p.month}
                  style={[styles.xLabel, { left: i * slot, width: slot }]}
                  numberOfLines={1}
                >
                  {formatMonthShort(p.month, locale)}
                </Text>
              ))}
              {/* On its own line: at a bar's width "Jan ’25" was cut off. */}
              {points.map((p, i) =>
                i === 0 || p.month.endsWith('-01') ? (
                  <Text
                    key={`y${p.month}`}
                    style={[styles.xYear, { left: i * slot + BAR_GAP }]}
                  >
                    {p.month.slice(0, 4)}
                  </Text>
                ) : null,
              )}
            </View>
          </View>
        </ScrollView>
      </View>
      <Text
        style={[
          styles.stat,
          paycheckMonths > 0 ? styles.statBad : styles.statGood,
        ]}
      >
        {paycheckMonths > 0
          ? t('runway.paycheckCount', {
              count: paycheckMonths,
              total: Math.min(12, points.length),
            })
          : t('runway.noPaycheckMonths')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  headline: { fontSize: 24, fontWeight: '700', color: colors.text },
  level: { fontSize: 14, fontWeight: '700', flex: 1 },
  month: { fontSize: 12, color: colors.textMuted },
  sub: { fontSize: 12, color: colors.textMuted },
  empty: { color: colors.textMuted, fontSize: 13 },
  chartRow: { flexDirection: 'row' },
  yLabel: {
    position: 'absolute',
    right: 6,
    fontSize: 10,
    color: colors.textMuted,
  },
  xLabel: {
    position: 'absolute',
    top: 2,
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
  },
  xYear: {
    position: 'absolute',
    top: 14,
    fontSize: 9,
    fontWeight: '700',
    color: colors.text,
  },
  stat: { fontSize: 13, fontWeight: '600' },
  statBad: { color: colors.negative },
  statGood: { color: colors.positive },
});
