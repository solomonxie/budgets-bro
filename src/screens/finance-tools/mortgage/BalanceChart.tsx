import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { formatMoney } from '../../../domain/money';
import type { ScheduleRow } from '../../../finance-tools/mortgagePlan';
import { useT } from '../../../i18n';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';

const HEIGHT = 120;

// One point a year is plenty at this size, and keeps the path short.
function yearly(rows: ScheduleRow[], startCents: number): number[] {
  const points = [startCents];
  for (let i = 11; i < rows.length; i += 12) points.push(rows[i].balanceCents);
  if (rows.length % 12 !== 0) points.push(rows[rows.length - 1].balanceCents);
  return points;
}

function path(points: number[], max: number, years: number, width: number) {
  return points
    .map((cents, i) => {
      const x = (i / Math.max(1, years)) * width;
      const y = HEIGHT - (cents / max) * HEIGHT;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

// What's owed over time: as scheduled, and with the planned extras when
// there are any. `todayYears` marks where a real mortgage is now.
export function BalanceChart({
  startCents,
  baseline,
  planned,
  firstYear,
  todayYears,
}: {
  startCents: number;
  baseline: ScheduleRow[];
  planned: ScheduleRow[] | null;
  firstYear: number;
  todayYears?: number;
}) {
  const t = useT();
  const [width, setWidth] = useState(0);
  const base = useMemo(
    () => yearly(baseline, startCents),
    [baseline, startCents],
  );
  const plan = useMemo(
    () => (planned ? yearly(planned, startCents) : null),
    [planned, startCents],
  );
  const years = base.length - 1;
  if (startCents <= 0 || years <= 0) return null;

  return (
    <View style={styles.wrap}>
      <View
        style={styles.chart}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <Line
              x1={0}
              y1={HEIGHT}
              x2={width}
              y2={HEIGHT}
              stroke={colors.border}
              strokeWidth={1}
            />
            {todayYears != null && todayYears > 0 ? (
              <Line
                x1={(todayYears / years) * width}
                y1={0}
                x2={(todayYears / years) * width}
                y2={HEIGHT}
                stroke={colors.textMuted}
                strokeWidth={1}
                strokeDasharray="3,3"
              />
            ) : null}
            <Path
              d={path(base, startCents, years, width)}
              stroke={plan ? colors.textMuted : colors.accent}
              strokeWidth={2}
              fill="none"
            />
            {plan ? (
              <Path
                d={path(plan, startCents, years, width)}
                stroke={colors.positive}
                strokeWidth={2}
                fill="none"
              />
            ) : null}
          </Svg>
        ) : null}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>
          {firstYear} · {formatMoney(startCents)}
        </Text>
        <Text style={styles.axisText}>{firstYear + years}</Text>
      </View>
      {plan ? (
        <View style={styles.legend}>
          <Text style={[styles.axisText, { color: colors.textMuted }]}>
            — {t('mortgagePlan.chartScheduled')}
          </Text>
          <Text style={[styles.axisText, { color: colors.positive }]}>
            — {t('mortgagePlan.chartWithExtras')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  chart: { height: HEIGHT },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { fontSize: 11, color: colors.textMuted },
  legend: { flexDirection: 'row', gap: spacing.md },
});
