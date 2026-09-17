import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { getDb } from '../../db/client';
import {
  clearAiRequests,
  listAiRequests,
} from '../../db/repositories/aiRequestsRepo';
import type { AiRequest } from '../../db/repositories/aiRequestsRepo';
import { aiVendorName } from '../../ai/aiKeys';
import type { AiKeyMeta } from '../../ai/aiKeys';
import { localeTag, useI18n } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface AiKeyHistoryModalProps {
  aiKey: AiKeyMeta | null;
  onClose: () => void;
}

// What a key actually sent, verbatim. The request counter on the Settings
// row says how much traffic a key carried; this says what that traffic was
// — the vendor's own dashboard shows token counts, not content, so without
// this the app's "your data only goes where you send it" claim can't be
// checked from inside the app.
//
// Entries start collapsed: the prompt is a whole formatted budget dump and
// a screen of it per row would bury the timestamps you came here to scan.
export function AiKeyHistoryModal({ aiKey, onClose }: AiKeyHistoryModalProps) {
  const { t, language } = useI18n();
  const [entries, setEntries] = useState<AiRequest[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!aiKey) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setExpandedId(null);
      const rows = await listAiRequests(await getDb(), aiKey.id);
      if (!cancelled) {
        setEntries(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aiKey]);

  if (!aiKey) return null;

  const stamp = (iso: string) =>
    new Date(iso).toLocaleString(localeTag(language), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const confirmClear = () =>
    Alert.alert(
      t('aiHistory.clearConfirmTitle'),
      t('aiHistory.clearConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await clearAiRequests(await getDb(), aiKey.id);
            setEntries([]);
          },
        },
      ],
    );

  return (
    <Modal
      visible={aiKey != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ScreenContainer modal>
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.headerBtn}>{t('common.done')}</Text>
          </Pressable>
          <Text style={styles.title}>{aiVendorName(aiKey.vendor)}</Text>
          <View style={styles.headerBtn} />
        </View>

        <Text style={styles.hint}>{t('aiHistory.hint')}</Text>

        <ScrollView contentContainerStyle={styles.list}>
          {!loading && entries.length === 0 ? (
            <Text style={styles.empty}>{t('aiHistory.empty')}</Text>
          ) : null}

          {entries.map((entry) => {
            const expanded = expandedId === entry.id;
            return (
              <Pressable
                key={entry.id}
                style={styles.entry}
                onPress={() => setExpandedId(expanded ? null : entry.id)}
              >
                <View style={styles.entryHead}>
                  <Text style={styles.entryTime}>{stamp(entry.createdAt)}</Text>
                  <Text
                    style={[
                      styles.entryStatus,
                      entry.error != null && styles.entryStatusError,
                    ]}
                  >
                    {entry.error != null
                      ? t('aiHistory.failed')
                      : t('aiHistory.ok')}
                  </Text>
                </View>

                {expanded ? (
                  <View style={styles.body}>
                    {entry.messages.map((message, i) => (
                      <View key={i} style={styles.block}>
                        <Text style={styles.blockLabel}>
                          {message.role === 'system'
                            ? t('aiHistory.system')
                            : t('aiHistory.prompt')}
                        </Text>
                        <Text style={styles.blockText} selectable>
                          {message.content}
                        </Text>
                      </View>
                    ))}
                    <View style={styles.block}>
                      <Text style={styles.blockLabel}>
                        {entry.error != null
                          ? t('aiHistory.error')
                          : t('aiHistory.response')}
                      </Text>
                      <Text
                        style={[
                          styles.blockText,
                          entry.error != null && styles.errorText,
                        ]}
                        selectable
                      >
                        {entry.error ?? entry.response ?? ''}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.preview} numberOfLines={2}>
                    {entry.error ?? entry.response ?? ''}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {entries.length > 0 ? (
          <Pressable style={styles.clearBtn} onPress={confirmClear}>
            <Text style={styles.clearText}>{t('aiHistory.clear')}</Text>
          </Pressable>
        ) : null}
      </ScreenContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerBtn: { color: colors.accent, fontWeight: '700', minWidth: 56 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  list: { padding: spacing.md, gap: spacing.sm },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  entry: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: 6,
  },
  entryHead: { flexDirection: 'row', justifyContent: 'space-between' },
  entryTime: { color: colors.text, fontSize: 14, fontWeight: '600' },
  entryStatus: { color: colors.textMuted, fontSize: 12 },
  entryStatusError: { color: colors.negative },
  preview: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  body: { gap: spacing.sm },
  block: { gap: 2 },
  blockLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  blockText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  errorText: { color: colors.negative },
  clearBtn: { alignItems: 'center', paddingVertical: spacing.md },
  clearText: { color: colors.negative, fontWeight: '700' },
});
