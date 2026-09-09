import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalculatorsHomeScreen } from '../calculators/CalculatorsHomeScreen';
import { AiAnalysisScreen } from '../ai/AiAnalysisScreen';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function ToolsScreen() {
  const [tab, setTab] = useState<'calculators' | 'ai'>('calculators');
  return (
    <View style={styles.container}>
      <View style={styles.segmented}>
        <Pressable
          style={[styles.segment, tab === 'calculators' && styles.segmentActive]}
          onPress={() => setTab('calculators')}
        >
          <Text style={[styles.segmentText, tab === 'calculators' && styles.segmentTextActive]}>Calculators</Text>
        </Pressable>
        <Pressable style={[styles.segment, tab === 'ai' && styles.segmentActive]} onPress={() => setTab('ai')}>
          <Text style={[styles.segmentText, tab === 'ai' && styles.segmentTextActive]}>AI Analysis</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>{tab === 'calculators' ? <CalculatorsHomeScreen /> : <AiAnalysisScreen />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    margin: spacing.md,
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
});
