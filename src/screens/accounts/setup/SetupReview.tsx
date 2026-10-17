import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ACCOUNT_KIND_ORDER, accountKind } from '../../../domain/accountKind';
import {
  amountCanBeNegative,
  amountMeaning,
} from '../../../domain/accountSetup';
import type { SuggestedAccount } from '../../../domain/accountSetup';
import { moneyTextFromDigits } from '../../../domain/money';
import { useT } from '../../../i18n';
import { KIND_LABEL_KEY } from '../accountTypeGuide';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { CheckCircle } from './CheckCircle';

export interface ReviewRow extends SuggestedAccount {
  name: string;
  exists: boolean;
}

export interface ReviewEdits {
  names: Record<string, string>;
  amounts: Record<string, string>;
  homeWorths: Record<string, string>;
  unticked: Set<string>;
}

// Grouped the way the Accounts page will show them, so what's confirmed here
// is what appears there. A name is a live field — renaming "Credit Card" to
// "Amex" is the most common edit — and an amount is optional.
export function SetupReview({
  rows,
  edits,
  clashes,
  onChange,
}: {
  rows: ReviewRow[];
  edits: ReviewEdits;
  // Lowercased names that would duplicate an account.
  clashes: Set<string>;
  onChange: (edits: ReviewEdits) => void;
}) {
  const t = useT();
  const fresh = rows.filter((r) => !r.exists);
  const existing = rows.filter((r) => r.exists);

  const setField = (
    field: 'names' | 'amounts' | 'homeWorths',
    id: string,
    value: string,
  ) => onChange({ ...edits, [field]: { ...edits[field], [id]: value } });

  const toggle = (id: string) => {
    const unticked = new Set(edits.unticked);
    if (unticked.has(id)) unticked.delete(id);
    else unticked.add(id);
    onChange({ ...edits, unticked });
  };

  const groups = ACCOUNT_KIND_ORDER.map((kind) => ({
    kind,
    rows: fresh.filter((r) => accountKind(r.type) === kind),
  })).filter((g) => g.rows.length > 0);

  if (fresh.length === 0) {
    return <Text style={styles.empty}>{t('accountSetup.reviewEmpty')}</Text>;
  }

  return (
    <View style={styles.wrap}>
      {groups.map((g) => (
        <View key={g.kind} style={styles.group}>
          <Text style={styles.groupLabel}>{t(KIND_LABEL_KEY[g.kind])}</Text>
          <View style={styles.card}>
            {g.rows.map((r, i) => {
              const on = !edits.unticked.has(r.id);
              const name = edits.names[r.id] ?? r.name;
              const meaning = t(
                `accountSetup.meaning.${amountMeaning(r.type)}` as 'accountSetup.meaning.balance',
              );
              const clash = on && clashes.has(name.trim().toLowerCase());
              return (
                <View
                  key={r.id}
                  style={[styles.row, i > 0 && styles.rowDivider]}
                >
                  <View style={styles.line}>
                    <Pressable
                      onPress={() => toggle(r.id)}
                      hitSlop={10}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={name}
                    >
                      <CheckCircle on={on} />
                    </Pressable>
                    <View style={styles.nameCol}>
                      <TextInput
                        style={[styles.name, !on && styles.off]}
                        value={name}
                        accessibilityLabel={t('accountSetup.nameField')}
                        onChangeText={(v) => setField('names', r.id, v)}
                        editable={on}
                        keyboardAppearance="dark"
                        returnKeyType="done"
                      />
                      {clash ? (
                        <Text style={[styles.caption, styles.clash]}>
                          {t('accountSetup.nameTaken')}
                        </Text>
                      ) : on ? (
                        <Text style={styles.caption}>{meaning}</Text>
                      ) : null}
                    </View>
                    {on ? (
                      <AmountInput
                        value={edits.amounts[r.id] ?? ''}
                        onChange={(v) => setField('amounts', r.id, v)}
                        signed={amountCanBeNegative(r.type)}
                        label={`${name}, ${meaning}`}
                      />
                    ) : null}
                  </View>
                  {on && r.type === 'mortgage' ? (
                    <View style={[styles.line, styles.subLine]}>
                      <Text style={[styles.caption, styles.subCaption]}>
                        {t('accountSetup.meaning.homeWorth')}
                      </Text>
                      <AmountInput
                        value={edits.homeWorths[r.id] ?? ''}
                        onChange={(v) => setField('homeWorths', r.id, v)}
                        label={`${name}, ${t('accountSetup.meaning.homeWorth')}`}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ))}
      {existing.length > 0 ? (
        <Text style={styles.footnote}>
          {t('accountSetup.alreadyHave', {
            names: existing.map((r) => r.name).join(', '),
          })}
        </Text>
      ) : null}
    </View>
  );
}

// The number pad has no minus key, so a signed amount gets a ± button: an
// overdrawn bank account, or a card that's in credit.
function AmountInput({
  value,
  onChange,
  signed = false,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  signed?: boolean;
  label: string;
}) {
  const t = useT();
  const negative = value.startsWith('-');
  const digits = negative ? value.slice(1) : value;
  return (
    <View style={styles.amountWrap}>
      {signed ? (
        <Pressable
          onPress={() => onChange(negative ? digits : `-${digits}`)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('accountSetup.flipSign')}
          style={styles.sign}
        >
          <Text style={[styles.signText, negative && styles.signOn]}>
            {negative ? '−' : '±'}
          </Text>
        </Pressable>
      ) : null}
      <TextInput
        style={[styles.amount, negative && styles.negative]}
        value={value}
        onChangeText={(text) => {
          const next = moneyTextFromDigits(text);
          onChange(negative && next !== '' ? `-${next}` : next);
        }}
        placeholder={t('common.amountPlaceholder')}
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        keyboardAppearance="dark"
        selectTextOnFocus
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  group: { gap: spacing.xs },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  row: { paddingVertical: 12, paddingHorizontal: spacing.md, gap: spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  subLine: { paddingLeft: 24 + spacing.md },
  nameCol: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text, padding: 0 },
  off: { color: colors.textMuted, textDecorationLine: 'line-through' },
  caption: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  subCaption: { flex: 1, marginTop: 0 },
  amount: {
    width: 116,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clash: { color: colors.negative },
  amountWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sign: { width: 22, alignItems: 'center' },
  signText: { fontSize: 17, fontWeight: '700', color: colors.textMuted },
  signOn: { color: colors.negative },
  negative: { color: colors.negative },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    paddingHorizontal: 2,
  },
  empty: { fontSize: 15, color: colors.textMuted, lineHeight: 21 },
});
