import { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface ScreenContainerProps extends PropsWithChildren {
  scroll?: boolean;
  // Rendered as a sibling of the (optionally scrolling) content, inside the
  // SafeAreaView — so an absolutely-positioned child (e.g. FloatingAddButton)
  // pins to the screen instead of to the scroll content's height.
  floating?: ReactNode;
}

export function ScreenContainer({ children, scroll, floating }: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
      {floating}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
