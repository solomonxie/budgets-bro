import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';

const MAX_LINES = 5;

// Explanatory prose that stays out of the way: five lines, then "More".
// The first layout pass runs unclamped to learn the real line count — a
// clamped Text only ever reports the lines it drew, so there is no other way
// to know whether the toggle is needed at all.
export function CollapsibleText({ text }: { text: string }) {
  const t = useT();
  const [lineCount, setLineCount] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const clamp = lineCount != null && lineCount > MAX_LINES && !expanded;

  return (
    <>
      <Text
        style={styles.text}
        numberOfLines={clamp ? MAX_LINES : undefined}
        onTextLayout={(e) => {
          if (lineCount == null) setLineCount(e.nativeEvent.lines.length);
        }}
      >
        {text}
      </Text>
      {lineCount != null && lineCount > MAX_LINES ? (
        <Pressable hitSlop={8} onPress={() => setExpanded((v) => !v)}>
          <Text style={styles.toggle}>
            {t(expanded ? 'common.less' : 'common.more')}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  toggle: { fontSize: 13, fontWeight: '700', color: colors.accent },
});
