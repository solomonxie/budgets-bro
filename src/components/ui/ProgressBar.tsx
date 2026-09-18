import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme/colors';

export interface ProgressSegment {
  percent: number;
  color: string;
}

// One or more coloured runs along a track, laid out left to right and
// clipped to the track's rounded ends. The track showing through is the
// unfilled remainder.
//
// A budget category uses two: what has been spent and what is still sitting
// in the envelope, each sized by its real share — so a half-spent category
// reads half and half rather than as a bar that happens to be halfway along.
export function ProgressBar({ segments }: { segments: ProgressSegment[] }) {
  return (
    <View style={styles.track}>
      {segments.map((segment, i) => (
        <View
          key={i}
          style={[styles.fill, { width: `${Math.max(0, Math.min(100, segment.percent))}%`, backgroundColor: segment.color }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  fill: {
    height: '100%',
  },
});
