import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Card } from '../../components/ui/Card';
import { ScheduleRow, ScheduleTableHeader } from '../../components/ui/ScheduleTable';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';

const PREVIEW_ROWS = 12;

// A 360-row amortization table inside the screen's own ScrollView would mount
// every row up front, so it opens on the first year and expands on request.
// (AmortizationCalculator uses a FlatList instead — it owns its whole screen
// and can virtualize; a calculator's table is one card among several.)
export function ScheduleCard({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;

  const visible = expanded ? rows : rows.slice(0, PREVIEW_ROWS);
  return (
    <Card title={title}>
      <ScheduleTableHeader columns={columns} />
      {visible.map((cells, i) => (
        <ScheduleRow key={i} cells={cells} />
      ))}
      {rows.length > PREVIEW_ROWS ? (
        <Pressable onPress={() => setExpanded((open) => !open)}>
          <Text style={styles.toggle}>
            {expanded ? t('financeTools.showLess') : t('financeTools.showAll', { count: rows.length })}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  toggle: { fontSize: 13, fontWeight: '700', color: colors.accent, textAlign: 'center', paddingTop: 10 },
});
