import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FieldRow } from './FieldCard';
import {
  ExpandedPanel,
  ExpandingFieldGroup,
  useExpandingField,
} from './ExpandingField';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// A row of a FieldCard that unfolds into a whole section rather than a list
// of options — the form's optional half, behind one row instead of four.
// Reads and behaves like every other picker row (label, summary of what is
// inside, chevron that turns when open).
//
// Its contents get a group of their own: a picker unfolded *inside* the
// section must not count as the outer form's one-open-row, or opening it
// would fold the section away underneath it.
export function ExpandingSection({
  label,
  summary,
  children,
}: {
  label: string;
  // What is in there, read from the collapsed row — a memo's first line, the
  // item names. Empty shows the label alone, as any unfilled row does.
  summary: string;
  children: ReactNode;
}) {
  const inline = useExpandingField();
  return (
    <View>
      <FieldRow
        label={label}
        value={summary}
        onPress={() => inline?.toggle()}
        expanded={inline?.expanded}
      />
      {inline?.expanded ? (
        <ExpandedPanel scroll={false}>
          <ExpandingFieldGroup>
            <View style={styles.body}>{children}</View>
          </ExpandingFieldGroup>
        </ExpandedPanel>
      ) : null}
    </View>
  );
}

// One labelled block inside a section. More of them is the point: the
// section is where a form's rarely-used parts collect.
export function SubSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.sub}>
      <Text style={styles.subLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, paddingVertical: spacing.xs },
  sub: { gap: spacing.xs },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
