import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function SettingsScreen() {
  return (
    <ScreenContainer>
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>About</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Version</Text>
            <Text style={styles.rowValue}>1.0.0 (MVP)</Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  sectionHeading: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  group: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  rowTitle: { fontSize: 15, color: colors.text },
  rowValue: { fontSize: 13, color: colors.textMuted },
});
