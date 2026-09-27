import { Line, Polyline, Text } from 'react-native-svg';
import { colors } from '../../theme/colors';

const LABEL_GAP = 4;
const LABEL_SIZE = 10;

// A dashed average across a chart, its figure written just above the line at
// the right end (below it when the line runs along the top edge).
export function AverageLine({
  y,
  width,
  label,
}: {
  y: number;
  width: number;
  label: string;
}) {
  const labelY =
    y - LABEL_GAP > LABEL_SIZE ? y - LABEL_GAP : y + LABEL_SIZE + 2;
  return (
    <>
      <Line
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke={colors.accent}
        strokeWidth={1.5}
        strokeDasharray="6,4"
      />
      <Text
        x={width - 2}
        y={labelY}
        fill={colors.accent}
        fontSize={LABEL_SIZE}
        fontWeight="700"
        textAnchor="end"
      >
        {label}
      </Text>
    </>
  );
}

// The same line when the average moves: one point per month, each that
// month's own trailing average. Labelled at the newest point.
export function MovingAverageLine({
  points,
  width,
  label,
}: {
  points: { x: number; y: number }[];
  width: number;
  label: string;
}) {
  const last = points.at(-1);
  if (!last) return null;
  const labelY =
    last.y - LABEL_GAP > LABEL_SIZE
      ? last.y - LABEL_GAP
      : last.y + LABEL_SIZE + 2;
  return (
    <>
      <Polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={colors.accent}
        strokeWidth={1.5}
        strokeDasharray="6,4"
      />
      <Text
        x={width - 2}
        y={labelY}
        fill={colors.accent}
        fontSize={LABEL_SIZE}
        fontWeight="700"
        textAnchor="end"
      >
        {label}
      </Text>
    </>
  );
}
