import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors } from '../../theme/colors';

export interface UnitOption<T extends string> {
  value: T;
  label: string;
}

interface UnitAmountFieldProps<T extends string> extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  units: UnitOption<T>[];
  unit: T;
  onUnitChange: (unit: T) => void;
  accessory?: ReactNode;
}

// An amount whose unit is part of the input, not a separate question: a down
// payment is either a percentage or a sum, a Chinese loan is quoted in 元 or
// 万元. The toggle sits inside the field's border so it reads as one control
// — asking for the unit in a second row made people miss it.
export function UnitAmountField<T extends string>({
  label,
  value,
  onChangeText,
  units,
  unit,
  onUnitChange,
  accessory,
  style,
  ...props
}: UnitAmountFieldProps<T>) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {accessory}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, style]}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.textMuted}
          keyboardAppearance="dark"
          keyboardType="decimal-pad"
          {...props}
        />
        <View style={styles.units}>
          {units.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => onUnitChange(option.value)}
              style={[styles.unit, option.value === unit && styles.unitSelected]}
            >
              <Text style={[styles.unitLabel, option.value === unit && styles.unitLabelSelected]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, flexShrink: 1 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingRight: 6,
  },
  input: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, color: colors.text },
  units: { flexDirection: 'row', gap: 4 },
  unit: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  unitSelected: { backgroundColor: colors.tint },
  unitLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  unitLabelSelected: { color: colors.accent },
});
