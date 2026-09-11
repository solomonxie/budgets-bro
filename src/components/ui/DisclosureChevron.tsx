import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme/colors';

interface DisclosureChevronProps {
  expanded: boolean;
  size?: number;
  color?: string;
}

// One glyph, rotated — the collapsed/expanded states used to swap between
// '›' and '⌄', two different Unicode characters with mismatched weight and
// baseline, which read as inconsistent rather than a single toggle.
export function DisclosureChevron({ expanded, size = 16, color = colors.textMuted }: DisclosureChevronProps) {
  return (
    <View style={{ transform: [{ rotate: expanded ? '0deg' : '-90deg' }] }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}
