import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { getDb } from '../../db/client';
import { listS3Objects } from '../../sync/s3Provider';
import type { S3ConfigMeta, S3ListEntry } from '../../sync/s3Provider';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface S3BrowserModalProps {
  config: S3ConfigMeta | null;
  onClose: () => void;
}

function basename(fullPrefixOrKey: string): string {
  return fullPrefixOrKey.replace(/\/$/, '').split('/').pop() ?? fullPrefixOrKey;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}

// Read-only browser for one saved bucket's content — scoped to its
// configured keyPrefix, which is the root here (`path` never goes above
// it, see s3Provider.listS3Objects). Pure navigation + metadata, no
// download/restore action — that already exists as "Restore from cloud"
// for the latest backup in Settings.
export function S3BrowserModal({ config, onClose }: S3BrowserModalProps) {
  const t = useT();
  const [path, setPath] = useState<string[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [objects, setObjects] = useState<S3ListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    setPath([]);
  }, [config]);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const db = await getDb();
        const result = await listS3Objects(db, config.id, path.join('/'));
        if (cancelled) return;
        setPrefixes(result.prefixes);
        setObjects(result.objects);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config, path]);

  if (!config) return null;

  const crumbs = [config.bucket, ...(config.keyPrefix ? [config.keyPrefix] : []), ...path];
  const rootCrumbCount = crumbs.length - path.length;

  return (
    <Modal visible={config != null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScreenContainer modal>
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.headerBtn}>{t('common.done')}</Text>
          </Pressable>
          <Text style={styles.title}>{t('s3Browser.title')}</Text>
          <View style={styles.headerBtn} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.breadcrumbs} contentContainerStyle={styles.breadcrumbsContent}>
          {crumbs.map((crumb, i) => (
            <Pressable
              key={i}
              onPress={() => setPath(i < rootCrumbCount ? [] : path.slice(0, i - rootCrumbCount + 1))}
              disabled={i === crumbs.length - 1}
            >
              <Text style={[styles.crumb, i === crumbs.length - 1 && styles.crumbActive]}>
                {crumb}
                {i < crumbs.length - 1 ? ' / ' : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? <ActivityIndicator style={styles.spinner} /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!loading && !error ? (
          <ScrollView contentContainerStyle={styles.list}>
            {path.length > 0 ? (
              <Pressable style={styles.row} onPress={() => setPath(path.slice(0, -1))}>
                <Text style={styles.rowIcon}>⬆︎</Text>
                <Text style={styles.rowTitle}>{t('s3Browser.up')}</Text>
              </Pressable>
            ) : null}
            {prefixes.map((prefix) => (
              <Pressable key={prefix} style={styles.row} onPress={() => setPath([...path, basename(prefix)])}>
                <Text style={styles.rowIcon}>📁</Text>
                <Text style={styles.rowTitle}>{basename(prefix)}</Text>
              </Pressable>
            ))}
            {objects.map((obj) => (
              <View key={obj.key} style={styles.row}>
                <Text style={styles.rowIcon}>📄</Text>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{basename(obj.key)}</Text>
                  <Text style={styles.rowValue}>
                    {formatSize(obj.size)} · {new Date(obj.lastModified).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
            {prefixes.length === 0 && objects.length === 0 ? <Text style={styles.hint}>{t('s3Browser.empty')}</Text> : null}
          </ScrollView>
        ) : null}
      </ScreenContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text, minWidth: 40 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  breadcrumbs: { flexGrow: 0, marginTop: spacing.sm },
  breadcrumbsContent: { paddingVertical: spacing.xs },
  crumb: { fontSize: 13, color: colors.textMuted },
  crumbActive: { color: colors.text, fontWeight: '700' },
  spinner: { marginTop: spacing.lg },
  errorText: { color: colors.negative, fontSize: 13, marginTop: spacing.md },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  list: { paddingTop: spacing.sm, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, color: colors.text },
  rowValue: { fontSize: 12, color: colors.textMuted },
});
