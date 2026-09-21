import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import type { BucketComparison } from '../../market/costOfLiving';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const HEIGHT = 240;
const PADDING = 28;

// City cost across, your spending up, and a diagonal where the two are
// equal. Everything above the line you spend more on than this city
// typically costs; everything below, less. A scatter rather than paired bars
// because the question is not "which is bigger" per row but "which rows are
// far from the line" — the ones worth doing something about.
export function CostQuadrantChart({
  rows,
  labelFor,
  formatAmount,
}: {
  rows: BucketComparison[];
  labelFor: (bucket: BucketComparison['bucket']) => string;
  formatAmount: (cents: number) => string;
}) {
  const { width } = useWindowDimensions();
  const size = Math.max(220, Math.min(width - spacing.md * 4, 360));
  const compared = rows.filter((r) => r.differenceCents != null);
  if (compared.length === 0) return null;

  const max = Math.max(
    ...compared.map((r) => Math.max(r.cityCents, r.yoursCents)),
    1,
  );
  const plot = size - PADDING * 2;
  const x = (cents: number) => PADDING + (cents / max) * plot;
  const y = (cents: number) => size - PADDING - (cents / max) * plot;

  return (
    <View style={styles.container}>
      <Svg width={size} height={HEIGHT > size ? size : size}>
        {/* Parity: same spend as the city. */}
        <Line
          x1={PADDING}
          y1={size - PADDING}
          x2={size - PADDING}
          y2={PADDING}
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <Line
          x1={PADDING}
          y1={PADDING}
          x2={PADDING}
          y2={size - PADDING}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Line
          x1={PADDING}
          y1={size - PADDING}
          x2={size - PADDING}
          y2={size - PADDING}
          stroke={colors.border}
          strokeWidth={1}
        />
        {compared.map((row) => {
          const above = (row.differenceCents ?? 0) > 0;
          return (
            <Circle
              key={row.bucket}
              cx={x(row.cityCents)}
              cy={y(row.yoursCents)}
              r={5}
              fill={above ? colors.negative : colors.positive}
            />
          );
        })}
        {compared.map((row) => (
          <SvgText
            key={`${row.bucket}-label`}
            x={x(row.cityCents) + 8}
            y={y(row.yoursCents) + 4}
            fontSize={10}
            fill={colors.textMuted}
          >
            {labelFor(row.bucket)}
          </SvgText>
        ))}
      </Svg>
      <View style={styles.axisRow}>
        <Text style={styles.axis}>{formatAmount(0)}</Text>
        <Text style={styles.axis}>{formatAmount(max)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 4 },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  axis: { fontSize: 10, color: colors.textMuted },
});
