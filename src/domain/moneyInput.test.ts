import { moneyTextFromDigits } from './money';

describe('moneyTextFromDigits', () => {
  it('fills from the right, so no decimal point is ever typed', () => {
    expect(moneyTextFromDigits('1')).toBe('0.01');
    expect(moneyTextFromDigits('12')).toBe('0.12');
    expect(moneyTextFromDigits('123')).toBe('1.23');
    expect(moneyTextFromDigits('1234')).toBe('12.34');
  });

  it('round-trips its own output plus one keystroke', () => {
    // What the field actually does: state is '12.34', a '5' is appended.
    expect(moneyTextFromDigits('12.345')).toBe('123.45');
    expect(moneyTextFromDigits('123.456')).toBe('1234.56');
  });

  it('walks back on backspace', () => {
    // '12.34' with the last character deleted.
    expect(moneyTextFromDigits('12.3')).toBe('1.23');
    expect(moneyTextFromDigits('1.2')).toBe('0.12');
  });

  it('empties out rather than sticking at zero', () => {
    expect(moneyTextFromDigits('')).toBe('');
    expect(moneyTextFromDigits('abc')).toBe('');
  });

  it('drops leading zeros instead of accumulating them', () => {
    // Typing more zeros into an empty field stays at zero rather than
    // blanking the field back out under the user.
    expect(moneyTextFromDigits('0.000')).toBe('0.00');
    expect(moneyTextFromDigits('0.005')).toBe('0.05');
  });

  it('ignores anything pasted in that is not a digit', () => {
    expect(moneyTextFromDigits('$1,234.56')).toBe('1234.56');
    expect(moneyTextFromDigits('-50')).toBe('0.50');
  });

  it('holds a large amount without losing cents', () => {
    expect(moneyTextFromDigits('123456789')).toBe('1234567.89');
  });
});
