import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  // Pinned above the scrollable list, not part of the scroll — the search
  // box on a searchable picker.
  stickyContent?: ReactNode;
  children: ReactNode;
}

// Shared chrome for every half-height picker (account, month, account type,
// category, payee): backdrop, drag handle, centered title with Cancel
// pinned top-left (kept as a real button, not just a fallback) — plus pull-
// down-to-dismiss from anywhere on the sheet, not only the handle/header.
//
// The drag is captured on the whole card, gated on the list already being
// scrolled to its top (scrollY <= 0) so it never fights the list's own
// scroll — dragging down mid-list just scrolls back up like normal; once
// you're at the top, the same drag starts pulling the sheet down instead.
export function BottomSheet({ title, onClose, stickyContent, children }: BottomSheetProps) {
  const t = useT();
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        scrollY.current <= 0 && gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 90 || gesture.vy > 0.8) onClose();
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Animated.View style={[styles.card, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.headerBtn, styles.headerBtnGhost]}>{t('common.cancel')}</Text>
          </View>
          {stickyContent}
          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={(e) => {
              scrollY.current = e.nativeEvent.contentOffset.y;
            }}
          >
            {children}
          </ScrollView>
        </Pressable>
      </Animated.View>
      <SafeAreaView edges={['bottom']} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: {
    maxHeight: '65%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
  },
  handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.accent },
  headerBtnGhost: { opacity: 0 },
  title: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.text, marginHorizontal: spacing.sm },
  list: { flexShrink: 1, marginTop: spacing.xs },
});
