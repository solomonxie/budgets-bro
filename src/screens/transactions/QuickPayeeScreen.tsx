import { useEffect, useState } from 'react';
import type React from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fuzzyScore } from '../../components/ui/SearchableDropdownField';
import { usePayees } from '../../hooks/usePayees';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Payee } from '../../domain/types';
import type { RootStackParamList } from '../../navigation/types';

const MAX_ROWS = 30;
// The last keyboard height seen; a guess until the first open.
let lastKeyboardHeight = 300;

type Nav = NativeStackNavigationProp<RootStackParamList, 'QuickPayee'>;

// The Spend tab's first step. Replaced by the form (not dismissed, then
// pushed), so the form slides in at once with the payee filled in.
export function QuickPayeeScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const { payees } = usePayees('usage');
  const [query, setQuery] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(lastKeyboardHeight);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardWillShow', (e) => {
      lastKeyboardHeight = e.endCoordinates.height;
      setKeyboardHeight(lastKeyboardHeight);
    });
    return () => sub.remove();
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q
    ? payees
        .map((p) => ({ p, score: fuzzyScore(p.name.toLowerCase(), q) }))
        .filter((m): m is { p: Payee; score: number } => m.score != null)
        .sort((a, b) => b.score - a.score)
        .map((m) => m.p)
    : payees;
  const hasExact = payees.some((p) => p.name.toLowerCase() === q);

  const pick = (name: string, id?: number) =>
    navigation.replace('AddTransaction', { presetPayee: { name, id } });
  const skip = () => navigation.replace('AddTransaction');

  const submit = () => {
    if (!q) skip();
    else if (matches[0]) pick(matches[0].name, matches[0].id);
    else pick(query.trim());
  };

  const shown = matches.slice(0, MAX_ROWS);

  const row = (
    key: string | number,
    picked: boolean,
    onPress: () => void,
    children: React.ReactNode,
  ) => (
    <Pressable
      key={key}
      style={({ pressed }) => [
        styles.option,
        (picked || pressed) && styles.pressed,
        picked && styles.picked,
      ]}
      onPress={onPress}
    >
      {children}
      {picked ? <Text style={styles.enter}>↵</Text> : null}
    </Pressable>
  );

  // A card over the page, placed where the keyboard will end up rather than
  // waiting for it to arrive (~500 ms). Tap outside to cancel; Done with
  // nothing typed opens the blank form.
  return (
    <View style={styles.fill}>
      <Pressable style={styles.backdrop} onPress={() => navigation.goBack()} />
      <View style={[styles.card, { marginBottom: keyboardHeight }]}>
        <TextInput
          style={styles.search}
          placeholder={t('spend.quickPayeePlaceholder')}
          placeholderTextColor={colors.textMuted}
          keyboardAppearance="dark"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submit}
          returnKeyType="done"
          submitBehavior="submit"
          autoFocus
          autoCorrect={false}
          autoCapitalize="words"
          autoComplete="off"
          spellCheck={false}
          textContentType="none"
          clearButtonMode="while-editing"
        />
        <ScrollView style={styles.list} keyboardShouldPersistTaps="always">
          {shown.map((p, i) =>
            row(
              p.id,
              !!q && i === 0,
              () => pick(p.name, p.id),
              <>
                <Text
                  style={[
                    styles.optionText,
                    !!q && i === 0 && styles.pickedText,
                  ]}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
                {p.linkedAccountId != null ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {t('payeePicker.accountBadge')}
                    </Text>
                  </View>
                ) : null}
              </>,
            ),
          )}
          {q && !hasExact
            ? row(
                'new',
                matches.length === 0,
                () => pick(query.trim()),
                <Text style={styles.useText} numberOfLines={1}>
                  {t('searchableDropdown.useText', { text: query.trim() })}
                </Text>,
              )
            : null}
        </ScrollView>
      </View>
    </View>
  );
}

const ROW_HEIGHT = 46;

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  // Five and a half rows: the half row says there's more below.
  list: { height: ROW_HEIGHT * 5.5, flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.surface },
  picked: { borderRadius: 10, borderBottomColor: 'transparent' },
  pickedText: { color: colors.accent },
  enter: { fontSize: 15, color: colors.accent, marginLeft: spacing.sm },
  optionText: { flex: 1, fontSize: 15, color: colors.text },
  badge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  useText: { flex: 1, fontSize: 15, color: colors.accent },
});
