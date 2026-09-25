import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';

const DEFAULT_MAX_LINES = 5;

// Explanatory prose that stays out of the way: a few lines, then "More"
// (or a tap on the text itself).
// The first layout pass runs unclamped to learn the real line count — a
// clamped Text only ever reports the lines it drew, so there is no other way
// to know whether the toggle is needed at all.
export function CollapsibleText({
  text,
  maxLines = DEFAULT_MAX_LINES,
  style,
  background = colors.background,
}: {
  text: string;
  maxLines?: number;
  style?: StyleProp<TextStyle>;
  // What the text sits on — "More" covers the end of the last line with it.
  background?: string;
}) {
  const t = useT();
  const [lineCount, setLineCount] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const foldable = lineCount != null && lineCount > maxLines;
  const clamp = foldable && !expanded;
  const toggle = () => setExpanded((v) => !v);

  return (
    <View>
      <Text
        style={[styles.text, style]}
        numberOfLines={clamp ? maxLines : undefined}
        onPress={foldable ? toggle : undefined}
        onTextLayout={(e) => {
          if (lineCount == null) setLineCount(e.nativeEvent.lines.length);
        }}
      >
        {text}
      </Text>
      {foldable ? (
        <Pressable
          hitSlop={8}
          onPress={toggle}
          style={
            clamp
              ? [styles.moreOverlay, { backgroundColor: background }]
              : styles.less
          }
        >
          <Text style={[styles.text, style, styles.toggle]}>
            {clamp ? `… ${t('common.more')}` : t('common.less')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  toggle: { fontWeight: '700', color: colors.accent },
  moreOverlay: { position: 'absolute', right: 0, bottom: 0, paddingLeft: 4 },
  less: { alignSelf: 'flex-end' },
});
