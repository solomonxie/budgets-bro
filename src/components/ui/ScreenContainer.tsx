import { PropsWithChildren, ReactNode, RefObject, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ScrollLockContext } from './scrollLock';

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
  // Off while a finger is dragging something that lives in the scroll.
  scrollEnabled?: boolean;
  // Pinned above the scroll — a figure that should stay in sight.
  header?: ReactNode;
}

export function ScreenContainer({
  children,
  scroll,
  modal,
  scrollRef,
  onScrollViewLayout,
  scrollEnabled = true,
  header,
}: ScreenContainerProps) {
  const [locked, setLocked] = useState(false);
  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={modal ? ['bottom', 'left', 'right'] : ['left', 'right']}
    >
      {header}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          onLayout={onScrollViewLayout}
          scrollEnabled={scrollEnabled && !locked}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          // Any field near the bottom of a scrolling screen would otherwise
          // open behind the keyboard — this insets the scroll by its height
          // and carries the focused field up.
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
        >
          <ScrollLockContext.Provider value={setLocked}>
            {children}
          </ScrollLockContext.Provider>
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
