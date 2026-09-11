import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { colors } from '../../theme/colors';

// Raised circular "+" in the middle of the tab bar, standing in for one of
// the five tab slots — see RootNavigator's "AddTransaction" fake tab, whose
// tabPress listener opens the Add Transaction sheet instead of navigating.
export function CenterAddButton({ onPress }: BottomTabBarButtonProps) {
  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Pressable style={styles.circle} onPress={onPress}>
        <Text style={styles.plus}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circle: {
    position: 'absolute',
    top: -22,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.background,
  },
  plus: { color: '#fff', fontSize: 28, fontWeight: '700', lineHeight: 30 },
});
