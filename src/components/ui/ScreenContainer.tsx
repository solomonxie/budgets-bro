import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface ScreenContainerProps extends PropsWithChildren {
  scroll?: boolean;
  // Screens pushed inside the bottom tab navigator sit above the tab bar,
  // which already reserves the home-indicator inset — padding for it again
  // here would just add a blank gap of background above the tab bar. Only
  // screens presented in their own full-screen Modal (no tab bar below
  // them) need it, and opt in with this.
  modal?: boolean;
}

export function ScreenContainer({ children, scroll, modal }: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={modal ? ['bottom', 'left', 'right'] : ['left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
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
