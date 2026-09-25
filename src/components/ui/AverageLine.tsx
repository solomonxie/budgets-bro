import { Line, Text } from 'react-native-svg';
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
