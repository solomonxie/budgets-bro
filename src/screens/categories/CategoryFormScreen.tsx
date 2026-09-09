import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import { Chip } from '../../components/ui/Chip';
import { getDb } from '../../db/client';
import * as categoriesRepo from '../../db/repositories/categoriesRepo';
import { useAppStore } from '../../state/useAppStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { SettingsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<SettingsStackParamList, 'CategoryForm'>;
type Route = RouteProp<SettingsStackParamList, 'CategoryForm'>;

const ICON_OPTIONS = ['🏠', '⚡', '🛒', '🚗', '🍽️', '🎬', '📱', '🔧', '💊', '🎓', '🎁', '💰'];

export function CategoryFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const categoryId = route.params?.categoryId;
  const initialGroupId = route.params?.groupId;
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    if (categoryId == null) return;
    (async () => {
      const db = await getDb();
      const categories = await categoriesRepo.listCategories(db);
      const category = categories.find((c) => c.id === categoryId);
      if (category) {
        setName(category.name);
        setIcon(category.icon);
      }
    })();
  }, [categoryId]);

  const save = async () => {
    if (!name.trim()) return;
    const db = await getDb();
    let groupId = initialGroupId;
    if (groupId == null) {
      if (!newGroupName.trim()) return;
      groupId = await categoriesRepo.createCategoryGroup(db, newGroupName.trim());
    }
    if (categoryId != null) {
      await categoriesRepo.updateCategory(db, categoryId, { groupId, name: name.trim(), icon });
    } else {
      await categoriesRepo.createCategory(db, { groupId, name: name.trim(), icon });
    }
    bumpDataVersion();
    navigation.goBack();
  };

  return (
    <ScreenContainer scroll>
      {initialGroupId == null && categoryId == null ? (
        <TextField label="Group Name" value={newGroupName} onChangeText={setNewGroupName} placeholder="e.g. Bills" />
      ) : null}
      <TextField label="Category Name" value={name} onChangeText={setName} placeholder="e.g. Groceries" />
      <View style={styles.field}>
        <Text style={styles.label}>Icon</Text>
        <View style={styles.chipRow}>
          {ICON_OPTIONS.map((opt) => (
            <Chip key={opt} label={opt} selected={icon === opt} onPress={() => setIcon(opt === icon ? null : opt)} />
          ))}
        </View>
      </View>
      <Pressable style={styles.saveButton} onPress={save}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
