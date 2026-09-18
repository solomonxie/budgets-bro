import { TextField } from './TextField';
import { moneyTextFromDigits } from '../../domain/money';

// An amount typed the way the spend pad takes one: digits fill in from the
// right, so "1234" is $12.34 and the decimal point is never typed. Same
// props as TextField — it owns the keyboard and the reformatting, and hands
// back the formatted text, so callers keep storing a plain dollar string.
export function MoneyField({
  value,
  onChangeText,
  ...props
}: Omit<React.ComponentProps<typeof TextField>, 'keyboardType'> & {
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <TextField
      {...props}
      value={value}
      onChangeText={(text) => onChangeText(moneyTextFromDigits(text))}
      keyboardType="number-pad"
    />
  );
}
