import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { ScrubMarker, useChartScrub } from './chartScrub';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const CHART_HEIGHT = 140;

// One line, no axis furniture. Neither thing it draws — an exchange rate, a
// benchmark house price — has a meaningful zero, so the y range is the
// window's own high and low, and the only labels worth drawing are those two
// plus whatever the finger is on.
export interface SeriesPoint {
  /** Whatever labels the x position — a date, a month. Shown on scrub. */
  label: string;
  value: number;
}

export function SeriesLineChart({
  points,
  formatValue,
}: {
  points: SeriesPoint[];
  formatValue: (value: number) => string;
}) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(200, width - spacing.md * 4);
  const [index, setIndex] = useState<number | null>(null);

  const { polyline, min, max } = useMemo(() => {
    if (points.length < 2) return { polyline: '', min: 0, max: 0 };
    const rates = points.map((p) => p.value);
    const lo = Math.min(...rates);
    const hi = Math.max(...rates);
    const span = hi - lo || 1;
    const stepX = chartWidth / (points.length - 1);
    return {
      polyline: points
        .map((p, i) => {
          const x = i * stepX;
          const y = CHART_HEIGHT - ((p.value - lo) / span) * CHART_HEIGHT;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' '),
      min: lo,
      max: hi,
    };
  }, [points, chartWidth]);

  const scrub = useChartScrub({
    count: points.length,
    chartWidth,
    onSelect: setIndex,
  });
  const selected = index != null ? points[index] : null;

  if (points.length < 2) return null;

  return (
    <View style={styles.container}>
      <View style={styles.readout}>
        <Text style={styles.readoutValue}>
          {formatValue(
            selected ? selected.value : points[points.length - 1].value,
          )}
        </Text>
        <Text style={styles.readoutDate}>
          {selected ? selected.label : points[points.length - 1].label}
        </Text>
      </View>
      <View {...scrub.handlers}>
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          <Polyline
            points={polyline}
            fill="none"
            stroke={colors.accent}
            strokeWidth={2}
          />
          {index != null ? (
            <ScrubMarker
              x={(index / (points.length - 1)) * chartWidth}
              height={CHART_HEIGHT}
            />
          ) : null}
        </Svg>
      </View>
      <View style={styles.bounds}>
        <Text style={styles.boundsText}>{formatValue(min)}</Text>
        <Text style={styles.boundsText}>{formatValue(max)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  readoutValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  readoutDate: { fontSize: 12, color: colors.textMuted },
  bounds: { flexDirection: 'row', justifyContent: 'space-between' },
  boundsText: { fontSize: 11, color: colors.textMuted },
});
