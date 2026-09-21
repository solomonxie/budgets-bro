import { StyleSheet, Text, View } from 'react-native';
import { CollapsibleText } from './CollapsibleText';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// A headed block of explanation: what this page or field is for, in prose,
// clamped to five lines with a "More". Used at the top of a screen to say
// what it does, and at the bottom for the part only some readers want.
export function GuideSection({
  heading,
  body,
}: {
  heading: string;
  body: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{heading}</Text>
      <CollapsibleText text={body} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 4, marginBottom: spacing.md },
  heading: { fontSize: 15, fontWeight: '700', color: colors.text },
});
