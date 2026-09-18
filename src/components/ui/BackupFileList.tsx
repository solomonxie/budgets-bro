import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface BackupFileEntry {
  key: string;
  title: string;
  subtitle?: string;
  // Absent for a folder, which navigates instead.
  onRestore?: () => void;
  onOpen?: () => void;
  restoring?: boolean;
}

// The list of what is in a backup destination, shared by the bucket and the
// iCloud folder so the two can't drift into looking like different apps.
//
// Grouped into one rounded panel with hairline dividers, the way the rest of
// the app's forms are (see FieldCard) — the previous version was a stack of
// bare rows with an emoji for an icon and a full-width outlined button under
// them, which read as a file manager bolted onto a budget app.
//
// A file's name leads and its size and date follow it quietly, because in a
// list of backups the only question is which one, and the name carries the
// month. The action is a text button, not a filled one: restoring is a thing
// you do once, not the point of the screen.
export function BackupFileList({ entries, restoreLabel }: { entries: BackupFileEntry[]; restoreLabel: string }) {
  if (entries.length === 0) return null;
  return (
    <View style={styles.card}>
      {entries.map((entry, i) => (
        <View key={entry.key}>
          {i > 0 ? <View style={styles.divider} /> : null}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && entry.onOpen != null && styles.rowPressed]}
            onPress={entry.onOpen}
            disabled={entry.onOpen == null}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {entry.title}
              </Text>
              {entry.subtitle ? <Text style={styles.rowSubtitle}>{entry.subtitle}</Text> : null}
            </View>
            {entry.restoring ? (
              <ActivityIndicator size="small" />
            ) : entry.onRestore ? (
              <Pressable onPress={entry.onRestore} hitSlop={10}>
                <Text style={styles.action}>{restoreLabel}</Text>
              </Pressable>
            ) : entry.onOpen ? (
              <Text style={styles.chevron}>›</Text>
            ) : null}
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  rowPressed: { backgroundColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, color: colors.text },
  rowSubtitle: { fontSize: 12, color: colors.textMuted },
  action: { fontSize: 14, fontWeight: '600', color: colors.accent },
  chevron: { fontSize: 17, color: colors.textMuted },
});
