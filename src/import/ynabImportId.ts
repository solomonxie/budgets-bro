// The identity of a YNAB register row, shared by the importer that writes it
// and the category repair that looks rows up by it. If these two ever built
// the key differently the repair would silently match nothing and report
// every row as "not in this board", so there is exactly one of them.
//
// Account + date + payee is the natural key: YNAB combines same-day,
// same-payee transactions on export, so that alone identifies a row without
// being brittle to a later memo or category edit. The occurrence counter
// tells apart genuine duplicates — two identical same-day purchases.
export function ynabImportId(accountName: string, date: string, payeeName: string, occurrence: number): string {
  return `ynab:${accountName}|${date}|${payeeName}|#${occurrence}`;
}

// Counts occurrences of the natural key as rows are walked, so the nth
// identical row gets the nth id. Callers must walk the file in its own
// order, the same way, for the numbering to line up.
export function makeOccurrenceCounter(): (accountName: string, date: string, payeeName: string) => number {
  const counts = new Map<string, number>();
  return (accountName, date, payeeName) => {
    const key = `${accountName}|${date}|${payeeName}`;
    const occurrence = counts.get(key) ?? 0;
    counts.set(key, occurrence + 1);
    return occurrence;
  };
}
