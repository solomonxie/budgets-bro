import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip } from './Chip';
import { spacing } from '../../theme/spacing';

interface ChipRowOption<T extends string> {
  value: T;
  label: string;
}

interface ChipRowProps<T extends string> {
  options: ChipRowOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

// Mode switches inside a calculator (solve-for target, repayment method,
// income vs. budget). Deliberately chips rather than a new segmented control
// — same visual language as the rest of the app, and it survives five
// options by scrolling instead of squeezing.
export function ChipRow<T extends string>({ options, value, onChange }: ChipRowProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        {options.map((option) => (
          <Chip key={option.value} label={option.label} selected={option.value === value} onPress={() => onChange(option.value)} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
});
