import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface MonthNavProps {
  label: string;
  month: string; // 'YYYY-MM'
  onPrevious: () => void;
  onNext: () => void;
  // Tapping the label unfolds the wheel. Omitted leaves the label inert and
  // stepping the only way to move.
  onSelect?: (month: string) => void;
}

function parseMonth(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(y || new Date().getFullYear(), (m || 1) - 1, 1);
}

// Shared month switcher for Budget and Insights. Stepping is what this is
// used for — the arrows are wide slabs, not the circular buttons they used
// to be, because "last month" is one tap and reaching for a 36pt circle for
// it was the thing that kept missing.
//
// Jumping to a far month unfolds the OS wheel in place, under the bar, the
// way every other picker in the app opens (see components/ui/ExpandingField)
// — it used to be a Modal floating over the page it was filtering.
export function MonthNav({
  label,
  month,
  onPrevious,
  onNext,
  onSelect,
}: MonthNavProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(() => parseMonth(month));

  // Stepping while the wheel is open moves the wheel with it, rather than
  // leaving it showing a month nothing is on any more.
  useEffect(() => {
    setDraft(parseMonth(month));
  }, [month]);

  const confirm = () => {
    onSelect?.(
      `${draft.getFullYear()}-${String(draft.getMonth() + 1).padStart(2, '0')}`,
    );
    setExpanded(false);
  };

  return (
    <View>
      <View style={styles.bar}>
        <Pressable
          style={({ pressed }) => [styles.arrowBtn, pressed && styles.arrowBtnPressed]}
          onPress={onPrevious}
        >
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Pressable
          style={styles.labelWrap}
          onPress={() => setExpanded((open) => !open)}
          disabled={!onSelect}
        >
          {/* No chevron: the month is the biggest thing on the bar between
              two arrows, and the wheel unfolding right under it says it
              opened better than a glyph hanging off the label did. */}
          <Text style={[styles.label, expanded && styles.labelOpen]}>{label}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.arrowBtn, pressed && styles.arrowBtnPressed]}
          onPress={onNext}
        >
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>
      {expanded && onSelect ? (
        <View style={styles.panel}>
          {/* The OS spinner owns its own vertical gesture, so it sits in a
              plain View — same reason DateField's unfolded picker does. */}
          <DateTimePicker
            value={draft}
            mode="date"
            display="spinner"
            onValueChange={(_, date) => setDraft(date)}
            textColor={colors.text}
            style={styles.picker}
          />
          <Pressable style={styles.confirmBtn} onPress={confirm}>
            <Text style={styles.confirmBtnText}>{t('common.done')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  // Wide enough to hit without looking — stepping a month is the most-used
  // control on both pages that carry this bar — and flat, like the number
  // pad's keys: an outlined box holding a tinted glyph, sitting inside
  // another outlined box, was two frames around one tap target. The glyph
  // is the button, and pressing it lights a patch under the thumb.
  arrowBtn: {
    width: 76,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnPressed: { backgroundColor: colors.border },
  arrow: { fontSize: 22, fontWeight: '600', color: colors.text, lineHeight: 24 },
  labelWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  label: { fontSize: 17, fontWeight: '700', color: colors.text },
  labelOpen: { color: colors.accent },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    marginTop: spacing.xs,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  picker: { alignSelf: 'center' },
  confirmBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
