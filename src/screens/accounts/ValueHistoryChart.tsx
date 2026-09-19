import { useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';
import { ScrubMarker, useChartScrub } from '../../components/ui/chartScrub';
import {
  buildGrowthSeries,
  projectGrowthOntoPeriods,
} from '../../domain/investmentGrowth';
import type { GrowthPoint } from '../../domain/investmentGrowth';
import {
  currentMonth,
  currentYear,
  formatMonthLabel,
  formatMonthShort,
  monthsBetween,
  yearsBetween,
} from '../../domain/month';
import { formatMoney, formatMoneyCompact } from '../../domain/money';
import { useI18n, localeTag } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const CHART_HEIGHT = 120;
const Y_AXIS_WIDTH = 44;
// How much of the trend fits without scrolling, and how tight a step can
// get before the x labels collide — a 'YYYY' label needs more room than
// 'Jan', and a yearly trend has far fewer steps to spend width on.
const STEP_SIZING = {
  month: { visible: 12, minWidth: 28 },
  year: { visible: 8, minWidth: 44 },
};

export type ValueHistoryChartMode = 'stacked' | 'single' | 'overlay';
export type ValueHistoryChartInterval = 'month' | 'year';

// A manually-logged value history (account_value_history), resampled onto
// a real calendar (months, or years — see `interval`) and drawn as a
// scrollable area chart — same shape/interaction as InsightsScreen's
// category-trend chart (a fixed window visible by default, drag to see
// further back). Shared by every account kind that logs one of these:
// - 'stacked': deposited (net real transactions) as the base band, gain
//   stacked on top — savings/cash/tracking accounts (see
//   domain/investmentGrowth.ts).
// - 'single': one band, the logged value itself.
// - 'overlay': the two figures as two lines over the same ground, each
//   drawn from zero rather than one stacked on the other — a mortgage's
//   debt and its equity, where the point is watching them cross.
export function ValueHistoryChart({
  history,
  transactions = [],
  series: prebuiltSeries,
  labels,
  baseColor = colors.textMuted,
  mode,
  interval = 'month',
}: {
  history: { valueCents: number; effectiveDate: string }[];
  transactions?: { amountCents: number; date: string }[];
  // A series worked out by the caller, for a stack that is not deposits and
  // gain — a mortgage hands it what is owed and the equity above it (see
  // domain/equityHistory). `history` still feeds the "enough to draw a
  // line?" check either way.
  series?: GrowthPoint[];
  // What the three stacked figures are called here. Deposited/gain/total
  // unless told otherwise.
  // With no `total`, the third figure is only shown while a finger is on
  // the chart (labelled with the period it is reading) — a mortgage's stack
  // is the debt and the equity, and their sum needs no billing of its own.
  labels?: { base: string; top: string; total?: string };
  baseColor?: string;
  mode: ValueHistoryChartMode;
  // 'year' exists for a history logged once in a long while; months are
  // the default and what every caller uses — a home value included, since
  // a flat run between appraisals still reads as the months it covers.
  interval?: ValueHistoryChartInterval;
}) {
  const { t, language } = useI18n();
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const series = useMemo(
    () =>
      prebuiltSeries ??
      buildGrowthSeries(history, mode === 'stacked' ? transactions : []),
    [prebuiltSeries, history, transactions, mode],
  );
  const latest = series.at(-1) ?? null;
  // The band's own colour is the story so far, whatever period a finger is
  // on: green while the account is up overall, red while it is down.
  const gainColor =
    latest != null && latest.gainCents < 0 ? colors.negative : colors.positive;

  const byYear = interval === 'year';
  const periods = useMemo(() => {
    if (series.length === 0) return [];
    const first = series[0].date;
    return byYear
      ? yearsBetween(first.slice(0, 4), currentYear())
      : monthsBetween(first.slice(0, 7), currentMonth());
  }, [series, byYear]);
  const projected = useMemo(
    () => projectGrowthOntoPeriods(series, periods),
    [series, periods],
  );

  const sizing = STEP_SIZING[interval];
  const fittedWidth = Math.max(
    200,
    windowWidth - spacing.md * 4 - Y_AXIS_WIDTH,
  );
  const stepWidth = Math.max(sizing.minWidth, fittedWidth / sizing.visible);
  const chartWidth = Math.max(fittedWidth, periods.length * stepWidth);
  const pointX = (i: number) =>
    periods.length > 1
      ? (i / (periods.length - 1)) * chartWidth
      : chartWidth / 2;

  const maxValue = Math.max(
    1,
    ...projected.map((p) =>
      p
        ? mode === 'overlay'
          ? Math.max(p.depositedCents, p.gainCents)
          : Math.max(p.totalCents, p.depositedCents)
        : 0,
    ),
  );
  const pointY = (v: number) =>
    CHART_HEIGHT - (v / maxValue) * (CHART_HEIGHT - 8) - 4;
  const yTicks = [maxValue, maxValue / 2, 0];

  // Reading the history with a finger, same gesture and marker as every
  // other chart (components/ui/chartScrub). The summary above the chart
  // follows it, so a period is read where its numbers already are.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const { scrollEnabled, handlers } = useChartScrub({
    count: periods.length,
    chartWidth,
    onSelect: setSelectedIndex,
  });
  const shown =
    (selectedIndex != null ? projected[selectedIndex] : null) ?? latest;
  const shownPeriod = selectedIndex != null ? periods[selectedIndex] : null;

  const depositedTops = projected.map((p) =>
    p ? Math.max(0, p.depositedCents) : 0,
  );
  const gainTops = projected.map((p, i) =>
    p ? depositedTops[i] + Math.max(0, p.gainCents) : depositedTops[i],
  );
  const totalLine = projected
    .map((p, i) => `${pointX(i)},${pointY(p ? p.totalCents : 0)}`)
    .join(' ');
  const depositedBand = [
    ...periods.map((_, i) => `${pointX(i)},${pointY(depositedTops[i])}`),
    ...periods.map((_, i, arr) => `${pointX(arr.length - 1 - i)},${pointY(0)}`),
  ].join(' ');
  const gainBand = [
    ...periods.map((_, i) => `${pointX(i)},${pointY(gainTops[i])}`),
    ...periods.map(
      (_, i, arr) =>
        `${pointX(arr.length - 1 - i)},${pointY(depositedTops[arr.length - 1 - i])}`,
    ),
  ].join(' ');
  // Each from the floor, so they read as two quantities over the same
  // ground and their crossing is the moment equity overtook the debt.
  const baseLine = projected
    .map((p, i) => `${pointX(i)},${pointY(p ? p.depositedCents : 0)}`)
    .join(' ');
  const topLine = projected
    .map((p, i) => `${pointX(i)},${pointY(p ? p.gainCents : 0)}`)
    .join(' ');
  const areaUnder = (tops: number[]) =>
    [
      ...tops.map((v, i) => `${pointX(i)},${pointY(v)}`),
      ...tops.map((_, i, arr) => `${pointX(arr.length - 1 - i)},${pointY(0)}`),
    ].join(' ');
  const baseArea = areaUnder(projected.map((p) => (p ? p.depositedCents : 0)));
  const topArea = areaUnder(projected.map((p) => (p ? p.gainCents : 0)));

  const singleBand = [
    ...periods.map((_, i) => `${pointX(i)},${pointY(gainTops[i])}`),
    ...periods.map((_, i, arr) => `${pointX(arr.length - 1 - i)},${pointY(0)}`),
  ].join(' ');

  const shownGainColor =
    shown != null && shown.gainCents < 0 ? colors.negative : colors.positive;
  const shownGainPct =
    shown != null && shown.depositedCents > 0
      ? (shown.gainCents / shown.depositedCents) * 100
      : null;
  // The stack's own sum: named by the caller, or by the period being read,
  // and otherwise left off for a stack whose two bands are the whole story.
  const shownPeriodLabel =
    shownPeriod == null
      ? null
      : byYear
        ? shownPeriod
        : formatMonthLabel(shownPeriod, localeTag(language));
  const totalLabel =
    shownPeriodLabel ??
    labels?.total ??
    (labels ? null : t('investmentGrowth.totalLabel'));

  // A trend needs two steps to be a trend — by year that means two
  // different years, not just two logged entries.
  if (series.length < 2 || periods.length < 2) {
    return (
      <Text style={styles.hint}>
        {t(
          byYear
            ? 'investmentGrowth.notEnoughYears'
            : 'investmentGrowth.notEnoughHistory',
        )}
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      {mode === 'stacked' || mode === 'overlay' ? (
        <View style={styles.summaryRow}>
          <SummaryStat
            label={labels?.base ?? t('investmentGrowth.depositedLabel')}
            value={formatMoney(shown!.depositedCents)}
            color={baseColor}
          />
          <SummaryStat
            label={labels?.top ?? t('investmentGrowth.gainLabel')}
            value={
              labels
                ? formatMoney(shown!.gainCents)
                : `${shown!.gainCents >= 0 ? '+' : ''}${formatMoney(shown!.gainCents)}${shownGainPct != null ? ` (${shownGainPct >= 0 ? '+' : ''}${shownGainPct.toFixed(1)}%)` : ''}`
            }
            color={shownGainColor}
          />
          {totalLabel != null ? (
            <SummaryStat
              label={totalLabel}
              value={formatMoney(shown!.totalCents)}
            />
          ) : null}
        </View>
      ) : (
        <SummaryStat
          label={shownPeriodLabel ?? t('investmentGrowth.totalLabel')}
          value={formatMoney(shown!.totalCents)}
        />
      )}
      {mode === 'stacked' && latest!.depositedCents === 0 ? (
        <Text style={styles.hint}>{t('investmentGrowth.noDepositsHint')}</Text>
      ) : null}

      <View style={styles.chartRow}>
        <View
          style={[styles.yAxis, { height: CHART_HEIGHT, width: Y_AXIS_WIDTH }]}
        >
          {yTicks.map((v) => (
            <Text key={v} style={[styles.yAxisLabel, { top: pointY(v) - 7 }]}>
              {formatMoneyCompact(v)}
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
              {yTicks.map((v) => (
                <Line
                  key={v}
                  x1={0}
                  y1={pointY(v)}
                  x2={chartWidth}
                  y2={pointY(v)}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              ))}
              {mode === 'overlay' ? (
                <>
                  <Polygon points={baseArea} fill={baseColor} fillOpacity={0.25} />
                  <Polygon points={topArea} fill={gainColor} fillOpacity={0.25} />
                  <Polyline
                    points={baseLine}
                    fill="none"
                    stroke={baseColor}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Polyline
                    points={topLine}
                    fill="none"
                    stroke={gainColor}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : mode === 'stacked' ? (
                <>
                  <Polygon
                    points={depositedBand}
                    fill={baseColor}
                    fillOpacity={0.35}
                  />
                  <Polygon
                    points={gainBand}
                    fill={gainColor}
                    fillOpacity={0.45}
                  />
                </>
              ) : (
                <Polygon
                  points={singleBand}
                  fill={colors.accent}
                  fillOpacity={0.35}
                />
              )}
              {mode === 'overlay' ? null : (
                <Polyline
                  points={totalLine}
                  fill="none"
                  stroke={colors.text}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {selectedIndex != null && shown != null ? (
                <>
                  <ScrubMarker
                    x={pointX(selectedIndex)}
                    y={pointY(
                      mode === 'overlay' ? shown.gainCents : shown.totalCents,
                    )}
                    height={CHART_HEIGHT}
                    color={mode === 'overlay' ? gainColor : colors.text}
                  />
                  {mode === 'overlay' ? (
                    <Circle
                      cx={pointX(selectedIndex)}
                      cy={pointY(shown.depositedCents)}
                      r={4}
                      fill={baseColor}
                    />
                  ) : null}
                </>
              ) : null}
            </Svg>
            <View style={[styles.xLabels, { width: chartWidth }]}>
              {periods.map((period, i) => {
                const isYearMarker =
                  byYear || i === 0 || period.endsWith('-01');
                const locale = localeTag(language);
                return (
                  <Text
                    key={period}
                    style={[styles.xLabel, isYearMarker && styles.xLabelYear]}
                  >
                    {byYear
                      ? period
                      : isYearMarker
                        ? `${formatMonthShort(period, locale)} ’${period.slice(2, 4)}`
                        : formatMonthShort(period, locale)}
                  </Text>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function SummaryStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { gap: 2 },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  chartRow: { flexDirection: 'row' },
  yAxis: { position: 'relative' },
  yAxisLabel: {
    position: 'absolute',
    right: 6,
    fontSize: 10,
    color: colors.textMuted,
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  xLabel: { fontSize: 10, color: colors.textMuted },
  xLabelYear: { fontWeight: '700', color: colors.text },
});
