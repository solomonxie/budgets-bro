// Months are 'YYYY-MM' strings throughout; dates are 'YYYY-MM-DD'. Both sort
// and compare correctly as plain strings, which the SQL layer relies on.

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function currentDateISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // `m` (1-indexed) is already next month's 0-indexed value
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function lastNMonths(month: string, n: number): string[] {
  const months = [month];
  let current = month;
  for (let i = 1; i < n; i++) {
    current = previousMonth(current);
    months.unshift(current);
  }
  return months;
}

// Inclusive 'YYYY-MM' range, ascending — for an all-time trend where the
// span length isn't known up front (unlike lastNMonths' fixed window).
export function monthsBetween(startMonth: string, endMonth: string): string[] {
  if (startMonth > endMonth) return [endMonth];
  const months = [startMonth];
  let current = startMonth;
  while (current < endMonth) {
    current = nextMonth(current);
    months.push(current);
  }
  return months;
}

export function formatMonthLabel(month: string, locale = 'en-US'): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function formatMonthShort(month: string, locale = 'en-US'): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' });
}

// Short weekday label ("Sun", "Mon"…) for weekday index 0 (Sunday) .. 6
// (Saturday) — matches Date.getUTCDay()'s order, used by the recurrence
// weekday picker (see components/ui/RepeatField). 2023-01-01 is a known
// Sunday, so `weekdayIndex` days past it lands on the matching weekday
// regardless of what "today" is.
export function formatWeekdayShort(weekdayIndex: number, locale = 'en-US'): string {
  const d = new Date(Date.UTC(2023, 0, 1 + weekdayIndex));
  return d.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });
}
