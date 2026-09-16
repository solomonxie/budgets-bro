import { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface CardProps {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  style?: ViewStyle;
}

// The bordered surface block every screen was re-declaring locally. Introduced
// with the finance tools (a dozen screens, ~3 cards each); existing screens
// keep their own copy until they're touched for other reasons.
export function Card({ title, children, footer, style }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
});
