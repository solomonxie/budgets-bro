import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { useCategories } from '../../hooks/useCategories';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { SettingsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<SettingsStackParamList, 'ManageCategories'>;

export function CategoriesScreen() {
  const navigation = useNavigation<Nav>();
  const { groups, categories } = useCategories();

  const byGroup = useMemo(
    () => groups.map((g) => ({ group: g, categories: categories.filter((c) => c.groupId === g.id) })),
    [groups, categories],
  );

  return (
    <ScreenContainer scroll>
      {byGroup.map(({ group, categories: cats }) => (
        <View key={group.id} style={styles.group}>
          <Text style={styles.groupLabel}>{group.name}</Text>
          {cats.map((c) => (
            <Pressable
              key={c.id}
              style={styles.row}
              onPress={() => navigation.navigate('CategoryForm', { categoryId: c.id, groupId: group.id })}
            >
              <Text style={styles.rowText}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </Text>
            </Pressable>
          ))}
          <Pressable style={styles.addRow} onPress={() => navigation.navigate('CategoryForm', { groupId: group.id })}>
            <Text style={styles.addRowText}>+ Add Category</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addGroupButton} onPress={() => navigation.navigate('CategoryForm', undefined)}>
        <Text style={styles.addGroupButtonText}>+ New Group &amp; Category</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  groupLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
  },
  rowText: { fontSize: 15, fontWeight: '600', color: colors.text },
  addRow: { paddingVertical: spacing.xs, paddingHorizontal: 2 },
  addRowText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  addGroupButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    borderStyle: 'dashed',
  },
  addGroupButtonText: { color: colors.accent, fontWeight: '700' },
});
