import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CardModal } from '../../components/ui/CardModal';
import { TextField } from '../../components/ui/TextField';
import type { CommunityPriceInput } from '../../db/repositories/communityPricesRepo';
import { parseMoneyToCents } from '../../domain/money';
import { currentMonth } from '../../domain/month';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// One reading of one community's benchmark price. Typed from whatever the
// user is reading — a board's monthly report, a listing site's area page —
// so the fields are the four things every such figure comes with.
export function CommunityPriceModal({
  visible,
  onCancel,
  onSave,
}: {
  visible: boolean;
  onCancel: () => void;
  onSave: (input: CommunityPriceInput) => Promise<void> | void;
}) {
  const t = useT();
  const [city, setCity] = useState('');
  const [community, setCommunity] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [price, setPrice] = useState('');

  const save = async () => {
    const cents = parseMoneyToCents(price);
    if (!city.trim() || !community.trim() || cents <= 0) return;
    await onSave({
      city: city.trim(),
      community: community.trim(),
      propertyType: propertyType.trim() || null,
      asOfMonth: month.trim(),
      benchmarkPriceCents: cents,
      note: null,
    });
    setPrice('');
  };

  return (
    <CardModal visible={visible} onCancel={onCancel}>
      <Text style={styles.title}>{t('housing.addBenchmarkTitle')}</Text>
      <Text style={styles.hint}>{t('housing.addBenchmarkHint')}</Text>
      <TextField label={t('housing.city')} value={city} onChangeText={setCity} />
      <TextField
        label={t('housing.community')}
        value={community}
        onChangeText={setCommunity}
        placeholder={t('housing.communityPlaceholder')}
      />
      <TextField
        label={t('housing.propertyType')}
        value={propertyType}
        onChangeText={setPropertyType}
        placeholder={t('housing.propertyTypePlaceholder')}
      />
      <TextField
        label={t('housing.month')}
        value={month}
        onChangeText={setMonth}
        placeholder="YYYY-MM"
      />
      <TextField
        label={t('housing.benchmarkPrice')}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        placeholder={t('common.amountPlaceholder')}
      />
      <View style={styles.actions}>
        <Pressable onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancel}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable onPress={save} hitSlop={8}>
          <Text style={styles.save}>{t('common.save')}</Text>
        </Pressable>
      </View>
    </CardModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
  cancel: { fontSize: 15, color: colors.textMuted },
  save: { fontSize: 15, fontWeight: '700', color: colors.accent },
});
