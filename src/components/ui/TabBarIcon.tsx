import Svg, { Path, Rect } from 'react-native-svg';

export type TabIconName = 'budget' | 'accounts' | 'insights';

interface TabBarIconProps {
  name: TabIconName;
  color: string;
  size?: number;
}

// Simple single-color line icons (react-native-svg — already a dependency,
// no icon-font package needed for just three glyphs) — flat outline style
// like YNAB's tab bar, not filled/colorful.
export function TabBarIcon({ name, color, size = 22 }: TabBarIconProps) {
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'budget' ? (
        <>
          <Rect x="3" y="4" width="18" height="16" rx="2" {...stroke} />
          <Path d="M3 9h18" {...stroke} />
          <Path d="M8 13.5h3" {...stroke} />
          <Path d="M8 16.5h6" {...stroke} />
        </>
      ) : name === 'accounts' ? (
        <>
          <Path d="M3 10l9-6 9 6" {...stroke} />
          <Path d="M5 10v9M10 10v9M14 10v9M19 10v9" {...stroke} />
          <Path d="M3 19h18" {...stroke} />
        </>
      ) : (
        <>
          <Path d="M4 20V11" {...stroke} />
          <Path d="M11 20V6" {...stroke} />
          <Path d="M18 20v-7" {...stroke} />
        </>
      )}
    </Svg>
  );
}
