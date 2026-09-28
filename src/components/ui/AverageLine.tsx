import { Polyline, Text } from 'react-native-svg';
import { colors } from '../../theme/colors';

const LABEL_GAP = 4;
const LABEL_SIZE = 10;

// A dashed moving average across a chart: one point per step, each that
// step's own trailing average. Its newest figure is written at the right
// end, above the line (below it when the line runs along the top edge).
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
