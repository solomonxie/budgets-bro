import { PropsWithChildren, RefObject } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
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
  // For a screen that needs to scroll something of its own into view — a
  // row that expands in place and would otherwise open below the fold (see
  // BudgetScreen). Only meaningful with `scroll`.
  scrollRef?: RefObject<ScrollView | null>;
  // The scroll viewport's own size — what a screen needs to park something
  // at the bottom of the screen rather than the top.
  onScrollViewLayout?: (event: LayoutChangeEvent) => void;
}

export function ScreenContainer({
  children,
  scroll,
  modal,
  scrollRef,
  onScrollViewLayout,
}: ScreenContainerProps) {
  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={modal ? ['bottom', 'left', 'right'] : ['left', 'right']}
    >
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          onLayout={onScrollViewLayout}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          // Any field near the bottom of a scrolling screen would otherwise
          // open behind the keyboard — this insets the scroll by its height
          // and carries the focused field up.
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
        >
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
