import type { useT } from './index';

export function relativeTime(iso: string | null, t: ReturnType<typeof useT>): string {
  if (!iso) return t('backup.never');
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (minutes < 1) return t('backup.justNow');
  if (minutes < 60) return t('backup.minutesAgo', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('backup.hoursAgo', { count: hours });
  return t('backup.daysAgo', { count: Math.round(hours / 24) });
}
